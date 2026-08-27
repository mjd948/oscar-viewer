/*
 * Copyright (c) 2024.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */
'use client';


import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {enableMapSet} from "immer";
// @ts-ignore
import {RootState} from "../Store";
// @ts-ignore
import {INode} from "@/app/data/osh/Node";
import {Node, serializeNode} from "@/lib/data/osh/Node";



enableMapSet();

export interface IOSHSlice {
    nodes: INode[],
    configNode: INode,
}


function loadNodesFromLocalStorage(): INode[] {
    if (typeof window === "undefined") return [];

    try {
        const stored = localStorage.getItem("osh_nodes");
        if (!stored) return [];

        const parsed = JSON.parse(stored);

        return parsed.map((n: any) => rehydrateNode(n));
    } catch(e) {
        console.error("Failed to load nodes from local storage", e);
        return [];
    }
}

function loadConfigNodeFromStorage(): INode | null {
    if (typeof window === "undefined") return [];

    try {
        const stored = localStorage.getItem("osh_config_node");
        if (!stored) return null;

        const parsed = JSON.parse(stored);
        if (!parsed) return null;

        return rehydrateNode(parsed);
    } catch(e) {
        console.error("Failed to load config node from local storage", e);
        return null;
    }
}


const initialState: IOSHSlice = {
    nodes: loadNodesFromLocalStorage(),
    configNode: loadConfigNodeFromStorage()
}

// Nodes saved by earlier builds are whole serialized Node instances rather than the
// PersistedNode projection, so they carry osh-js API clients and an oscarServiceSystem
// husk alongside the fields below. The constructor reads only the fields it knows and
// rejects an oscarServiceSystem that is not a live System, so both shapes load.
function rehydrateNode(obj: any): Node {
    return new Node({
        ...obj
    });
}

// Only the node's own configuration is written out. Serializing the Node instance itself
// also wrote the four osh-js API clients it holds, each carrying another copy of the
// node's username and password - see PersistedNode.
function persistNodes(nodes: INode[]) {
    localStorage.setItem("osh_nodes", JSON.stringify(nodes.map((node: INode) => serializeNode(node))));
}

function persistConfigNode(node: INode | null) {
    localStorage.setItem("osh_config_node", JSON.stringify(node ? serializeNode(node) : null));
}

export const Slice = createSlice({
    name: 'OSHSlice',
    initialState,
    reducers: {
        addNode: (state, action: PayloadAction<INode>) => {
            state.nodes.push(action.payload);
            persistNodes(state.nodes);

        },
        setNodes: (state, action: PayloadAction<INode[]>) => {
            state.nodes = action.payload
            persistNodes(state.nodes);
        },
        /**
         * Replaces an existing node with an edited copy of it.
         *
         * Keyed on the id the edit started from. Matching used to be by name, so renaming
         * a node quietly saved nothing at all: the lookup searched for the new name and
         * found no row. Matching on the new id would fail the same way, since the id is
         * derived from the address and port and changes whenever either is edited.
         */
        updateNode: (state, action: PayloadAction<{previousId: string, node: INode}>) => {
            const {previousId, node} = action.payload;
            const nodeIndex = state.nodes.findIndex((n: INode) => n.id === previousId);
            if (nodeIndex === -1) return;

            state.nodes[nodeIndex] = node as Node;
            persistNodes(state.nodes);

            // The config node is a separate copy rather than a reference into the list, so
            // without this it stays behind at the old address for as long as localStorage
            // survives - and it is what the app boots against.
            if (state.configNode?.id === previousId) {
                state.configNode = node;
                persistConfigNode(state.configNode);
            }
        },
        removeNode: (state, action: PayloadAction<string>) => {
            const nodeIndex = state.nodes.findIndex((node: INode) => node.id === action.payload);
            state.nodes.splice(nodeIndex, 1);
            persistNodes(state.nodes);
        },
        changeConfigNode: (state, action: PayloadAction<INode>) => {
            state.configNode = action.payload;
            persistConfigNode(state.configNode);

        },
    },
})


export const {
    addNode,
    setNodes,
    updateNode,
    removeNode,
    changeConfigNode,
} = Slice.actions;

export const selectNodes = (state: RootState) => state.oshSlice.nodes;
export const selectDefaultNode = (state: RootState) => state.oshSlice.nodes.find((node: INode) => node.isDefaultNode);

export default Slice.reducer;
