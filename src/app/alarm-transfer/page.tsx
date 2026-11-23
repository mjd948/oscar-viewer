"use client";

import React from "react";
import {Grid, Paper, Stack, Typography} from "@mui/material";
import AlarmTransferImport from "@/app/_components/alarm-transfer/AlarmTransferImport";
import {useLanguage} from "@/app/contexts/LanguageContext";
import {PlatformIconBadge} from "@/app/_components/common/PlatformIcons";

export default function AlarmTransferPage() {
    const {t} = useLanguage();
    return (
        <Grid container spacing={2} width="100%">
            <Grid item xs={12}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <PlatformIconBadge iconKey="alarm-transfer" size="header" />
                    <Typography variant="h4">{t("alarmTransfer")}</Typography>
                </Stack>
            </Grid>
            <Grid item xs={12}>
                <Paper variant="outlined" sx={{p: 2}}><AlarmTransferImport/></Paper>
            </Grid>
        </Grid>
    );
}
