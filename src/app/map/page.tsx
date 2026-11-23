"use client";

import {Grid, Paper, Stack, Typography} from "@mui/material";
import dynamic from "next/dynamic";
import {useMemo} from "react";
import {useLanguage} from "@/app/contexts/LanguageContext";
import SuspenseLoad from "@/app/_components/SuspenseLoad";
import {PlatformIconBadge} from "@/app/_components/common/PlatformIcons";

export default function MapViewPage() {
    const { t } = useLanguage();


    const Map = useMemo(() => dynamic(
        () => import('@/app/_components/maps/MapComponent'),
        {
            loading: () => <SuspenseLoad />,
            ssr: false
        }
    ),[])

    return (
        <Grid container spacing={2} width={"100%"}>
            <Grid item xs={12}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <PlatformIconBadge iconKey="map" size="header" />
                    <Typography variant="h4">
                        { t('map') }
                    </Typography>
                </Stack>
            </Grid>
            <Grid item xs={12} sx={{ gap: 2, minWidth: 0 }}>
                <Paper variant='outlined' sx={{ padding: 1 }}>
                    <Map/>
                </Paper>
            </Grid>
        </Grid>
    );
}


