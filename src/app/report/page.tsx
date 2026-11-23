"use client"

import {
    Grid,
    Stack,
    Typography
} from "@mui/material"
import React from "react";
import Report from "@/app/_components/reportgen/Report";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {PlatformIconBadge} from "@/app/_components/common/PlatformIcons";

export default function ReportViewPage() {
    const { t } = useLanguage();

    return (
        <Grid container spacing={2} width={"100%"}>
            <Grid item xs={12}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <PlatformIconBadge iconKey="report" size="header" />
                    <Typography variant="h4">
                        { t('reportGenerator') }
                    </Typography>
                </Stack>
            </Grid>
            <Grid item xs={12} width={"100%"} minWidth={0}>
                <Report/>
            </Grid>
        </Grid>
    )
}