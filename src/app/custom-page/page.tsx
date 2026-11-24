"use client";

/*
 * Copyright (c) 2026.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import DashboardRoute from "@/app/_components/layout/DashboardRoute";

/** Legacy URL /custom-page/?id=<pageId>: opens the dashboard and rewrites to /dashboard/?name=. */
export default function CustomPage() {
    return <DashboardRoute/>;
}
