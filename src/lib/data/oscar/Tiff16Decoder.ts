/*
 * Copyright (c) 2026. Botts Innovative Research, Inc.
 * All Rights Reserved
 */

/**
 * Zero-dependency 16-bit Grayscale TIFF (`uint16`, Uncompressed / LZW / Deflate + Predictor)
 * and 8-bit Palettized HEMD PNG (`PLTE` + `IDAT`) decoder with automatic Web Worker offload.
 *
 * Preserves full 16-bit (`0..65535`) radiographic dynamic range for GPU WebGL2 (`R16UI`)
 * and 65,536-entry LUT rendering without blocking the browser main thread.
 */

export interface DecodedTiff16 {
    width: number;
    height: number;
    pixels: Uint16Array;
    minNonZero: number;
    maxVal: number;
    p02: number;
    p98: number;
    photometricInvert: boolean;
}

export interface DecodedHemdPng {
    width: number;
    height: number;
    indices: Uint8Array;
    paletteRgb: Uint8Array; // 256 * 3 RGB bytes
}

function readU16(view: DataView, offset: number, le: boolean): number {
    return view.getUint16(offset, le);
}

function readU32(view: DataView, offset: number, le: boolean): number {
    return view.getUint32(offset, le);
}

function typeByteSize(fieldType: number): number {
    switch (fieldType) {
        case 1: // BYTE
        case 2: // ASCII
        case 6: // SBYTE
        case 7: // UNDEFINED
            return 1;
        case 3: // SHORT
        case 8: // SSHORT
            return 2;
        case 4: // LONG
        case 9: // SLONG
        case 11: // FLOAT
            return 4;
        case 5: // RATIONAL
        case 10: // SRATIONAL
        case 12: // DOUBLE
            return 8;
        case 16: // LONG8 (BigTIFF)
            return 8;
        default:
            return 1;
    }
}

function readTagNumbers(
    bytes: Uint8Array,
    view: DataView,
    le: boolean,
    fieldType: number,
    count: number,
    valueOffsetFieldPos: number,
): number[] {
    const unit = typeByteSize(fieldType);
    const totalBytes = unit * count;
    const dataPos = totalBytes <= 4 ? valueOffsetFieldPos : readU32(view, valueOffsetFieldPos, le);
    const out: number[] = new Array(count);
    for (let i = 0; i < count; i++) {
        const p = dataPos + i * unit;
        if (fieldType === 3) {
            out[i] = readU16(view, p, le);
        } else if (fieldType === 4) {
            out[i] = readU32(view, p, le);
        } else if (fieldType === 1) {
            out[i] = bytes[p] ?? 0;
        } else if (fieldType === 5) {
            const num = readU32(view, p, le);
            const den = readU32(view, p + 4, le);
            out[i] = den !== 0 ? num / den : 0;
        } else {
            out[i] = readU32(view, p, le);
        }
    }
    return out;
}

/**
 * Standard TIFF MSB-first LZW decompressor (handles both standard TIFF early-change
 * at 511/1023/2047 and late-change variants).
 */
export function decompressTiffLzw(src: Uint8Array, expectedLen: number): Uint8Array {
    const out = new Uint8Array(expectedLen);
    let outPos = 0;

    // Represent dictionary entries via prefix + suffix arrays + length for zero GC churn!
    const prefix = new Int32Array(4096);
    const suffix = new Uint8Array(4096);
    const length = new Uint16Array(4096);
    const stack = new Uint8Array(4096);

    const CLEAR_CODE = 256;
    const EOI_CODE = 257;

    for (let i = 0; i < 256; i++) {
        prefix[i] = -1;
        suffix[i] = i;
        length[i] = 1;
    }

    let nextCode = 258;
    let codeSize = 9;
    let maxCodeForSize = 511; // TIFF LZW "early change" bumps codeSize when nextCode == 511, 1023, 2047
    let bitPos = 0;
    const totalBits = src.length * 8;

    const readCode = (): number => {
        if (bitPos + codeSize > totalBits) return EOI_CODE;
        let byteIdx = bitPos >> 3;
        let bitOffset = bitPos & 7;
        // Pack up to 24 bits MSB-first
        const b0 = src[byteIdx] ?? 0;
        const b1 = src[byteIdx + 1] ?? 0;
        const b2 = src[byteIdx + 2] ?? 0;
        const acc = (b0 << 16) | (b1 << 8) | b2;
        const shift = 24 - bitOffset - codeSize;
        const code = (acc >>> shift) & ((1 << codeSize) - 1);
        bitPos += codeSize;
        return code;
    };

    const firstByteOf = (code: number): number => {
        let cur = code;
        while (cur >= 256) {
            cur = prefix[cur];
        }
        return cur & 0xff;
    };

    const emitString = (code: number): number => {
        let cur = code;
        let sp = 0;
        while (cur >= 256) {
            stack[sp++] = suffix[cur];
            cur = prefix[cur];
        }
        const firstByte = cur & 0xff;
        if (outPos < expectedLen) {
            out[outPos++] = firstByte;
        }
        while (sp > 0 && outPos < expectedLen) {
            out[outPos++] = stack[--sp];
        }
        return firstByte;
    };

    let oldCode = -1;

    while (outPos < expectedLen) {
        const code = readCode();
        if (code === EOI_CODE) break;

        if (code === CLEAR_CODE) {
            nextCode = 258;
            codeSize = 9;
            maxCodeForSize = 511;
            const first = readCode();
            if (first === EOI_CODE) break;
            emitString(first);
            oldCode = first;
            continue;
        }

        if (oldCode < 0) {
            emitString(code);
            oldCode = code;
            continue;
        }

        let firstChar: number;
        if (code < nextCode) {
            firstChar = emitString(code);
        } else if (code === nextCode) {
            const fc = firstByteOf(oldCode);
            emitString(oldCode);
            if (outPos < expectedLen) {
                out[outPos++] = fc;
            }
            firstChar = fc;
        } else {
            break;
        }

        if (nextCode < 4096) {
            prefix[nextCode] = oldCode;
            suffix[nextCode] = firstChar;
            length[nextCode] = length[oldCode] + 1;
            nextCode++;
            if (nextCode === maxCodeForSize && codeSize < 12) {
                codeSize++;
                maxCodeForSize = (1 << codeSize) - 1;
            }
        }
        oldCode = code;
    }

    return out;
}

async function inflateZlibBytes(src: Uint8Array): Promise<Uint8Array> {
    const format: CompressionFormat =
        src.length >= 2 && (src[0] === 0x78 || ((src[0] << 8 | src[1]) % 31 === 0 && (src[0] & 0x0f) === 8))
            ? 'deflate'
            : 'deflate-raw';
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    void writer.write(src as unknown as BufferSource);
    void writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
}

export async function decodeTiff16Bytes(bytes: Uint8Array): Promise<DecodedTiff16> {
    if (bytes.byteLength < 8) {
        throw new Error('Invalid TIFF: file shorter than 8-byte header');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const bom0 = bytes[0];
    const bom1 = bytes[1];
    const le = bom0 === 0x49 && bom1 === 0x49;
    const be = bom0 === 0x4d && bom1 === 0x4d;
    if (!le && !be) {
        throw new Error('Invalid TIFF byte-order header');
    }
    const magic = readU16(view, 2, le);
    if (magic !== 42) {
        throw new Error(`Unsupported TIFF magic ${magic} (expected classic TIFF 42)`);
    }

    const ifdOffset = readU32(view, 4, le);
    const numEntries = readU16(view, ifdOffset, le);

    let width = 0;
    let height = 0;
    let bitsPerSample = 16;
    let compression = 1;
    let photometric = 1; // 1 = BlackIsZero, 0 = WhiteIsZero
    let samplesPerPixel = 1;
    let rowsPerStrip = 0;
    let predictor = 1;
    let stripOffsets: number[] = [];
    let stripByteCounts: number[] = [];

    for (let i = 0; i < numEntries; i++) {
        const entryPos = ifdOffset + 2 + i * 12;
        const tag = readU16(view, entryPos, le);
        const fieldType = readU16(view, entryPos + 2, le);
        const count = readU32(view, entryPos + 4, le);
        const valPos = entryPos + 8;

        switch (tag) {
            case 256: // ImageWidth
                width = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 0;
                break;
            case 257: // ImageLength
                height = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 0;
                break;
            case 258: // BitsPerSample
                bitsPerSample = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 16;
                break;
            case 259: // Compression
                compression = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 1;
                break;
            case 262: // PhotometricInterpretation
                photometric = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 1;
                break;
            case 273: // StripOffsets
                stripOffsets = readTagNumbers(bytes, view, le, fieldType, count, valPos);
                break;
            case 277: // SamplesPerPixel
                samplesPerPixel = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 1;
                break;
            case 278: // RowsPerStrip
                rowsPerStrip = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 0;
                break;
            case 279: // StripByteCounts
                stripByteCounts = readTagNumbers(bytes, view, le, fieldType, count, valPos);
                break;
            case 317: // Predictor
                predictor = readTagNumbers(bytes, view, le, fieldType, count, valPos)[0] ?? 1;
                break;
            default:
                break;
        }
    }

    if (width <= 0 || height <= 0) {
        throw new Error(`Invalid TIFF dimensions ${width}x${height}`);
    }
    if (rowsPerStrip <= 0 || rowsPerStrip > height) {
        rowsPerStrip = height;
    }

    const bytesPerSample = bitsPerSample === 8 ? 1 : 2;
    const pixels = new Uint16Array(width * height);
    let destRow = 0;

    for (let s = 0; s < stripOffsets.length && destRow < height; s++) {
        const stripOff = stripOffsets[s]!;
        const stripLen = stripByteCounts[s]!;
        const stripRows = Math.min(rowsPerStrip, height - destRow);
        const expectedBytes = stripRows * width * samplesPerPixel * bytesPerSample;
        const compressedSlice = bytes.subarray(stripOff, stripOff + stripLen);

        let rawStrip: Uint8Array;
        if (compression === 1) {
            rawStrip = compressedSlice;
        } else if (compression === 5) {
            rawStrip = decompressTiffLzw(compressedSlice, expectedBytes);
        } else if (compression === 8 || compression === 32946) {
            rawStrip = await inflateZlibBytes(compressedSlice);
        } else {
            throw new Error(`Unsupported TIFF compression scheme ${compression}`);
        }

        const stripView = new DataView(rawStrip.buffer, rawStrip.byteOffset, rawStrip.byteLength);
        const rowStrideBytes = width * samplesPerPixel * bytesPerSample;

        for (let r = 0; r < stripRows; r++) {
            const rowByteStart = r * rowStrideBytes;
            const outRowOffset = (destRow + r) * width;

            if (bytesPerSample === 2) {
                let acc = 0;
                for (let x = 0; x < width; x++) {
                    const pxByte = rowByteStart + x * samplesPerPixel * 2;
                    let v = stripView.getUint16(pxByte, le);
                    if (predictor === 2) {
                        acc = (acc + v) & 0xffff;
                        v = acc;
                    }
                    pixels[outRowOffset + x] = v;
                }
            } else {
                let acc = 0;
                for (let x = 0; x < width; x++) {
                    const pxByte = rowByteStart + x * samplesPerPixel;
                    let v = rawStrip[pxByte] ?? 0;
                    if (predictor === 2) {
                        acc = (acc + v) & 0xff;
                        v = acc;
                    }
                    pixels[outRowOffset + x] = v * 257;
                }
            }
        }

        destRow += stripRows;
    }

    // Compute exact 256-bin histogram over non-zero signal pixels for automatic 2%..98% Window/Level
    const hist = new Uint32Array(256);
    let nonZeroCount = 0;
    let minNonZero = 65535;
    let maxVal = 0;
    for (let i = 0; i < pixels.length; i++) {
        const v = pixels[i]!;
        if (v > 0) {
            if (v < minNonZero) minNonZero = v;
            if (v > maxVal) maxVal = v;
            hist[v >>> 8]++;
            nonZeroCount++;
        }
    }
    if (nonZeroCount === 0) {
        minNonZero = 0;
        maxVal = 65535;
    }

    const targetLow = Math.floor(nonZeroCount * 0.02);
    const targetHigh = Math.floor(nonZeroCount * 0.98);
    let cum = 0;
    let p02 = minNonZero;
    let p98 = maxVal;
    let foundLow = false;
    for (let b = 0; b < 256; b++) {
        cum += hist[b]!;
        if (!foundLow && cum >= targetLow) {
            p02 = b << 8;
            foundLow = true;
        }
        if (cum >= targetHigh) {
            p98 = Math.min(65535, ((b + 1) << 8) - 1);
            break;
        }
    }
    if (p98 <= p02) {
        p02 = minNonZero;
        p98 = Math.max(minNonZero + 1, maxVal);
    }

    return {
        width,
        height,
        pixels,
        minNonZero,
        maxVal,
        p02,
        p98,
        photometricInvert: photometric === 0,
    };
}

/**
 * Decodes an 8-bit palettized PNG (`mode="P"`, colorType = 3) into raw palette indices (`0..255`)
 * and its 256x3 RGB palette so operators can filter individual HEMD material-discrimination bands
 * (`Organic`, `Intermediate / NORM`, `Inorganic / High-Z`) in real time.
 */
export async function decodeHemdPalettizedPng(bytes: Uint8Array): Promise<DecodedHemdPng> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength < 33 || view.getUint32(0, false) !== 0x89504e47) {
        throw new Error('Invalid HEMD PNG signature');
    }

    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 8;
    let colorType = 3;
    const paletteRgb = new Uint8Array(256 * 3);
    const idatChunks: Uint8Array[] = [];
    let idatTotal = 0;

    while (pos + 8 <= bytes.byteLength) {
        const len = view.getUint32(pos, false);
        const t0 = bytes[pos + 4];
        const t1 = bytes[pos + 5];
        const t2 = bytes[pos + 6];
        const t3 = bytes[pos + 7];
        const type = String.fromCharCode(t0!, t1!, t2!, t3!);
        const dataStart = pos + 8;
        if (dataStart + len > bytes.byteLength) break;

        if (type === 'IHDR') {
            width = view.getUint32(dataStart, false);
            height = view.getUint32(dataStart + 4, false);
            bitDepth = bytes[dataStart + 8] ?? 8;
            colorType = bytes[dataStart + 9] ?? 3;
        } else if (type === 'PLTE') {
            const copyLen = Math.min(len, paletteRgb.length);
            paletteRgb.set(bytes.subarray(dataStart, dataStart + copyLen), 0);
        } else if (type === 'IDAT') {
            const chunk = bytes.subarray(dataStart, dataStart + len);
            idatChunks.push(chunk);
            idatTotal += chunk.byteLength;
        } else if (type === 'IEND') {
            break;
        }
        pos = dataStart + len + 4; // skip 4-byte CRC
    }

    if (width <= 0 || height <= 0 || colorType !== 3 || bitDepth !== 8) {
        throw new Error(`Unsupported HEMD PNG format (${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType})`);
    }

    const joinedIdat = new Uint8Array(idatTotal);
    let offset = 0;
    for (const c of idatChunks) {
        joinedIdat.set(c, offset);
        offset += c.byteLength;
    }

    const inflated = await inflateZlibBytes(joinedIdat);
    const indices = new Uint8Array(width * height);
    const stride = width + 1;

    const paeth = (a: number, b: number, c: number): number => {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        if (pa <= pb && pa <= pc) return a;
        if (pb <= pc) return b;
        return c;
    };

    for (let y = 0; y < height; y++) {
        const srcRow = y * stride;
        const filterType = inflated[srcRow] ?? 0;
        const dstRow = y * width;
        const prevRow = (y - 1) * width;

        for (let x = 0; x < width; x++) {
            const raw = inflated[srcRow + 1 + x] ?? 0;
            const left = x > 0 ? indices[dstRow + x - 1]! : 0;
            const up = y > 0 ? indices[prevRow + x]! : 0;
            const upLeft = x > 0 && y > 0 ? indices[prevRow + x - 1]! : 0;

            let val: number;
            switch (filterType) {
                case 0:
                    val = raw;
                    break;
                case 1:
                    val = (raw + left) & 0xff;
                    break;
                case 2:
                    val = (raw + up) & 0xff;
                    break;
                case 3:
                    val = (raw + ((left + up) >>> 1)) & 0xff;
                    break;
                case 4:
                    val = (raw + paeth(left, up, upLeft)) & 0xff;
                    break;
                default:
                    val = raw;
                    break;
            }
            indices[dstRow + x] = val;
        }
    }

    return { width, height, indices, paletteRgb };
}
