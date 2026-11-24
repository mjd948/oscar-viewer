"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import React, {Suspense, useContext, useEffect, useRef} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {useSelector} from "react-redux";
import {Box, CircularProgress} from "@mui/material";
import PageHost from "@/app/_components/layout/PageHost";
import PageToolbar from "@/app/_components/layout/PageToolbar";
import {selectPages} from "@/lib/state/PageLayoutSlice";
import {PageConfig} from "@/lib/layout/PageConfigTypes";
import {dashboardHref, findPageBySlug} from "@/lib/layout/MainPages";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";

/**
 * A widget dashboard by URL name: /dashboard/?name=<slug>. The legacy /custom-page/?id=<pageId>
 * (and /dashboard/?id=) still open the page and are rewritten to its name URL. Static export
 * emits real dashboard/ and custom-page/ index.html files, so hard reloads work on plain static
 * file servers (OSH node) and in Electron without SPA fallback.
 */
function DashboardRouteInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const {scopedHref} = useContext(DataSourceContext);
    const pages: PageConfig[] = useSelector(selectPages);
    const name = searchParams.get('name');
    const legacyId = searchParams.get('id');
    // The page shown last, so a rename (which changes its slug) follows it to the new URL.
    const shown = useRef<{ id: string; slug?: string } | null>(null);
    const renamed = shown.current && name && shown.current.slug === name
        ? pages.find((p) => p.id === shown.current?.id)
        : undefined;
    const page = findPageBySlug(pages, name)
        ?? (legacyId ? pages.find((p) => p.id === legacyId) : undefined)
        ?? renamed;
    // Keep the URL's name until the URL catches up, so renders before router.replace lands still resolve.
    shown.current = page ? {id: page.id, slug: name ?? page.slug} : null;
    const canonical = page && page.slug && page.slug !== name ? dashboardHref(page) : undefined;

    useEffect(() => {
        if (canonical) router.replace(scopedHref(canonical));
    }, [canonical, router, scopedHref]);

    // PageHost shows "Page not found" for an unknown name.
    const pageId = page?.id ?? '';
    return (
        <Box sx={{width: '100%'}}>
            <PageToolbar pageId={pageId}/>
            <PageHost pageId={pageId}/>
        </Box>
    );
}

export default function DashboardRoute() {
    return (
        <Suspense fallback={
            <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}>
                <CircularProgress/>
            </Box>
        }>
            <DashboardRouteInner/>
        </Suspense>
    );
}
