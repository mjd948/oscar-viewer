"use client";

import * as React from 'react';
import {useEffect, useState} from 'react';
import {CSSObject, styled, Theme} from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, {AppBarProps as MuiAppBarProps} from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import UsbRoundedIcon from '@mui/icons-material/UsbRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import MediationIcon from '@mui/icons-material/Mediation';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import {
    Alert,
    Badge,
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    InputLabel,
    Menu,
    MenuItem,
    Select,
    SelectChangeEvent,
    Slider,
    Stack,
    Switch,
    Tooltip,
} from '@mui/material';
import Link from 'next/link';
import {Download, InsertChart, VolumeDown, VolumeUp} from "@mui/icons-material";
import AlarmAudio, { applyAlarmAudioVolume } from "@/app/_components/AlarmAudio";
import {
    selectAlarmAudioVolume,
    selectContinuousAlarmAudio,
    selectVisualUnreadAlert,
    setAlarmAudioVolume,
    setContinuousAlarmAudio,
    setVisualUnreadAlert,
} from "@/lib/state/OSCARClientSlice";
import {useDispatch, useSelector} from "react-redux";
import {useTheme} from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {selectNavPages} from "@/lib/state/PageLayoutSlice";
import {PageConfig} from "@/lib/layout/PageConfigTypes";
import {getPageIcon} from "@/app/_components/layout/WidgetRegistry";
import AddPageDialog from "@/app/_components/layout/AddPageDialog";
import {HeaderSlotProvider} from "@/app/_components/layout/HeaderSlot";
import { useBreakpoint } from '../providers';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { usePathname, useRouter } from 'next/navigation';
import {setEventPreview, setSelectedRowId} from "@/lib/state/EventPreviewSlice";
import {selectDashboardUnreadAlarmCount, setSelectedEvent} from "@/lib/state/EventDataSlice";
import {setEventData} from "@/lib/state/EventDetailsSlice";
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import {DataSourceContext} from "@/app/contexts/DataSourceContext";
import {buildEventDetailsHref} from "@/lib/data/oscar/EventLookup";
import {
    ALL_LANES_SELECT_VALUE,
    resolveRouteForViewSwitch,
    resolveScopedViewDropdownState,
} from "@/lib/data/oscar/OperationalView";
import HelpDialog from "@/app/_components/HelpDialog";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SplitscreenRoundedIcon from "@mui/icons-material/SplitscreenRounded";
import TrainingCoachDock from "@/app/_components/sandbox/TrainingCoachDock";
import {TRAINING_COACH_UI} from "@/lib/data/oscar/TrainingCurriculum";
import {
    dispatchSandboxRefreshEvents,
    fetchSandboxActiveStatus,
    SandboxActiveStatus,
    SandboxVerificationSnapshot,
} from "@/lib/data/oscar/TrainingSandboxApi";
import {RootState} from "@/lib/state/Store";

const drawerWidth = 276;
const drawerWidthMobile = 236;

const openedMixin = (theme: Theme): CSSObject => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    width: `calc(${theme.spacing(7)} + 1px)`,
    [theme.breakpoints.up('sm')]: {
        width: `calc(${theme.spacing(8)} + 1px)`,
    },
});

// Used to place content below the app bar
const DrawerHeader = styled('div')(({theme}) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
    isDesktop?: boolean;
}

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open' && prop !== "isDesktop"
})<AppBarProps>(({theme, open, isDesktop}) => ({
    zIndex: theme.zIndex.drawer + 1,
    // Exit transition
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...((open && isDesktop) && {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        // Entrance transition
        transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
    ...((open && !isDesktop) && {
        width: `calc(100% - ${drawerWidthMobile}px)`,
        // Entrance transition
        transition: theme.transitions.create(['transform'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const Drawer = styled(MuiDrawer, {shouldForwardProp: (prop) => prop !== 'open'})(
    ({theme, open}) => ({
        width: drawerWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...(open && {
            ...openedMixin(theme),
            '& .MuiDrawer-paper': openedMixin(theme),
        }),
        ...(!open && {
            ...closedMixin(theme),
            '& .MuiDrawer-paper': closedMixin(theme),
        }),
    }),
);

export default function Navbar({children}: { children: React.ReactNode }) {
    const { isDesktop } = useBreakpoint();

    const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null); // Anchor element for settings menu
    const settingsMenuOpen = Boolean(settingsAnchorEl); // Open state for settings menu
    const [helpDialogOpen, setHelpDialogOpen] = useState(false);

    const [drawerOpen, setDrawerOpen] = useState(false);  // Open state for navigation drawer
    const { t, language } = useLanguage();
    const coachUi = TRAINING_COACH_UI[language] ?? TRAINING_COACH_UI.en;
    const [sandboxStatus, setSandboxStatus] = useState<SandboxActiveStatus>({ sandboxMode: false });
    const [coachOpen, setCoachOpen] = useState<boolean>(false);
    const [splitAdminOpen, setSplitAdminOpen] = useState<boolean>(false);

    const dispatch = useDispatch();
    const router = useRouter();
    const pathname = usePathname();
    const dataSourceCtx = React.useContext(DataSourceContext);
    const activeViewKey = dataSourceCtx?.activeViewKey ?? null;
    const viewError = dataSourceCtx?.viewError ?? null;
    const availableViews = dataSourceCtx?.availableViews ?? [];
    const totalCatalogLaneCount = dataSourceCtx?.totalCatalogLaneCount ?? 0;
    const setActiveView = dataSourceCtx?.setActiveView;
    const scopedHref = dataSourceCtx?.scopedHref ?? ((p: string) => p);
    const currentSession = dataSourceCtx?.currentSession ?? null;
    const scopedViewLabelId = React.useId();
    const scopedViewDropdown = React.useMemo(
        () => resolveScopedViewDropdownState({
            availableViews,
            allowedViews: currentSession?.allowedViews ?? [],
            activeViewKey,
            viewError,
        }),
        [activeViewKey, availableViews, currentSession?.allowedViews, viewError],
    );
    const scopedSelectValue = React.useMemo(() => {
        if (activeViewKey === null) {
            return scopedViewDropdown.includeAllLanes ? ALL_LANES_SELECT_VALUE : "";
        }
        return scopedViewDropdown.options.some((opt) => opt.key === activeViewKey)
            ? activeViewKey
            : "";
    }, [activeViewKey, scopedViewDropdown.includeAllLanes, scopedViewDropdown.options]);

    const handleScopedViewChange = React.useCallback(
        (event: SelectChangeEvent<string>) => {
            const raw = event.target.value;
            const nextKey = raw === ALL_LANES_SELECT_VALUE || raw === "" ? null : raw;
            const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "/");
            const currentSearch = typeof window !== "undefined" ? window.location.search : "";
            const nextRoute = resolveRouteForViewSwitch(currentPath, currentSearch, nextKey);
            setActiveView?.(nextKey);
            const nextPathname = nextRoute.split("?")[0];
            if (nextPathname !== currentPath) {
                router.push(nextRoute);
            }
        },
        [pathname, router, setActiveView],
    );
    // Custom widget pages (user-built; ORNL's own pages stay in menuItems) and the app-bar slot
    // their PageToolbar portals into.
    const navPages = useSelector(selectNavPages);
    const [addPageOpen, setAddPageOpen] = useState(false);
    const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
    const isDarkMode = useTheme().palette.mode === 'dark';
    const savedVolume = useSelector(selectAlarmAudioVolume);
    const continuousAlarmAudio = useSelector(selectContinuousAlarmAudio);
    const visualUnreadAlert = useSelector(selectVisualUnreadAlert);
    const unreadAlarmCount = useSelector(selectDashboardUnreadAlarmCount);
    const configuredNodes = useSelector((state: RootState) => state.oshSlice?.nodes ?? []);
    const [fallbackUsername, setFallbackUsername] = useState<string | null>(null);
    const authenticatedUsername = currentSession?.username ?? fallbackUsername;

    useEffect(() => {
        if (currentSession?.username) return;
        const controller = new AbortController();
        fetch('/session', {
            credentials: 'include',
            headers: {'Accept': 'application/json'},
            signal: controller.signal,
        })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Session lookup returned ${response.status}`)))
            .then((session) => setFallbackUsername(typeof session.username === 'string' ? session.username : null))
            .catch((error) => {
                if (error.name !== 'AbortError')
                    console.warn('Unable to read the current OSCAR session', error);
            });
        return () => controller.abort();
    }, [currentSession?.username]);

    const prevSandboxVerificationRef = React.useRef<SandboxVerificationSnapshot | undefined>(
        undefined,
    );

    const applyNextSandboxStatus = React.useCallback((next: SandboxActiveStatus) => {
        const prevVer = prevSandboxVerificationRef.current;
        const nextVer = next.verification;
        if (next.sandboxMode && prevVer && nextVer) {
            const lanesChanged =
                prevVer.configuredLaneCount !== nextVer.configuredLaneCount ||
                prevVer.onlineLaneCount !== nextVer.onlineLaneCount ||
                prevVer.operationalViewCount !== nextVer.operationalViewCount ||
                (prevVer.operationalViews ?? []).join(",") !== (nextVer.operationalViews ?? []).join(",");
            const telemetryChanged =
                lanesChanged || prevVer.activeFaultOrTamper !== nextVer.activeFaultOrTamper;
            const eventsChanged =
                lanesChanged ||
                prevVer.totalOccupancies !== nextVer.totalOccupancies ||
                prevVer.operatorAdjudicatedCount !== nextVer.operatorAdjudicatedCount ||
                prevVer.emlCode9999Count !== nextVer.emlCode9999Count ||
                prevVer.extendedCode9998Count !== nextVer.extendedCode9998Count;
            if (lanesChanged || telemetryChanged || eventsChanged) {
                dispatchSandboxRefreshEvents({
                    lanes: lanesChanged,
                    telemetry: telemetryChanged,
                    events: eventsChanged,
                });
            }
        }
        prevSandboxVerificationRef.current = nextVer;
        setSandboxStatus(next);
    }, []);

    const refreshSandboxStatus = React.useCallback(() => {
        fetchSandboxActiveStatus()
            .then((next) => applyNextSandboxStatus(next))
            .catch(() => {});
    }, [applyNextSandboxStatus]);

    useEffect(() => {
        let cancelled = false;
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        const controller = new AbortController();

        fetchSandboxActiveStatus(controller.signal)
            .then((initial) => {
                if (cancelled) return;
                prevSandboxVerificationRef.current = initial.verification;
                setSandboxStatus(initial);
                if (initial.sandboxMode) {
                    setCoachOpen(true);
                    pollTimer = setInterval(() => {
                        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
                            return;
                        }
                        fetchSandboxActiveStatus()
                            .then((next) => {
                                if (!cancelled) applyNextSandboxStatus(next);
                            })
                            .catch(() => {});
                    }, 4_000);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
            controller.abort();
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [applyNextSandboxStatus]);

    const handleLogout = async () => {
        try {
            await fetch('/logout', {method: 'POST', credentials: 'include'});
        } finally {
            window.location.assign('/login');
        }
    };

    const handleSettingsMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setSettingsAnchorEl(event.currentTarget);
    };

    const handleSettingsMenuClose = () => {
        setSettingsAnchorEl(null);
    };
    const [notificationsEnabled, setNotificationsEnabled] = useState<NotificationPermission>('default');

    useEffect(() => {
        console.log('[Navbar] Mounting');

        if ('Notification' in window) {
            setNotificationsEnabled(Notification.permission);
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registered:', registration.scope);
                })
                .catch((error) => {
                    console.error('[PWA] Service Worker registration failed:', error);
                });

            const handleServiceWorkerMessage = (event: MessageEvent) => {
                if (event.data?.type === 'VIEW_EVENTS') {
                    router.push(scopedHref('/event-log'));
                    return;
                }
                if (event.data?.type === 'VIEW_ALARM') {
                    const eventData = event.data.eventData;
                    if (eventData) {
                        dispatch(setEventPreview({ isOpen: true, eventData }));
                        dispatch(setSelectedRowId(eventData.id));
                        dispatch(setSelectedEvent(eventData));
                        dispatch(setEventData(eventData));
                    }
                    const eventId = event.data.eventId ?? eventData?.occupancyObsId;
                    const href = eventId
                        ? buildEventDetailsHref(eventId, event.data.nodeId)
                        : '/event-log';
                    router.push(scopedHref(href));
                }
            };

            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
            return () => {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            };
        } else {
            console.warn('[PWA] Service Worker not supported');
        }
    }, [dispatch, router, scopedHref]);

    // fix where u can actually turn notifications off
    const handleNotifications = async () => {
        if (!('Notification' in window)) {
            alert(t('notificationsNotSupported'));
            return;
        }

        if (Notification.permission === 'granted') {
            return;
        }

        const permission = await Notification.requestPermission();
        setNotificationsEnabled(permission);

        if (permission === 'granted') {
            new Notification(t('notificationsEnabled'), {
                body: t('notificationsEnabledBody')
            });
        }
    }

    // Handle opening drawer
    const handleDrawerOpen = () => {
        setDrawerOpen(true);
    };

    // Handle closing drawer
    const handleDrawerClose = () => {
        setDrawerOpen(false);
    };

    useEffect(() => {
        const handleOpenDrawerEvent = () => {
            if (!isDesktop) {
                setDrawerOpen(true);
            }
        };
        window.addEventListener('oscar:open-nav-drawer', handleOpenDrawerEvent);
        return () => {
            window.removeEventListener('oscar:open-nav-drawer', handleOpenDrawerEvent);
        };
    }, [isDesktop]);

    const [volumeValue, setVolumeValue] = useState(savedVolume);

    useEffect(() => {
        setVolumeValue(savedVolume);
    }, [savedVolume]);

    const handleVolumeChange = (event: Event, newValue: number | number[]) => {
        const volume = newValue as number;
        setVolumeValue(volume);
        applyAlarmAudioVolume(volume);
        dispatch(setAlarmAudioVolume(volume));
    };

    // Menu items for drawer
    const menuItems = [
        {
            title: t('dashboard'),
            icon: <DashboardRoundedIcon/>,
            href: "/",
            testId: "nav-item-dashboard",
        },
        {
            title: t('events'),
            icon: <WarningRoundedIcon/>,
            href: "/event-log",
            testId: "nav-item-events",
        },
        {
            title: t('stateOfHealth'),
            icon: <MonitorHeartRoundedIcon/>,
            href: "/health/",
            testId: "nav-item-health",
        },
        {
            title: t('map'),
            icon: <LocationOnRoundedIcon/>,
            href: "/map",
            testId: "nav-item-map",
        },
        {
            title: t('national'),
            icon: <MediationIcon/>,
            href: "/national-view",
            testId: "nav-item-national",
        },
        {
            title: t('reportGenerator'),
            icon: <InsertChart/>,
            href: "/report",
            testId: "nav-item-report",
        },
        {
            title: t('alarmTransfer'),
            icon: <QrCodeScannerRoundedIcon/>,
            href: "/alarm-transfer",
            testId: "nav-item-alarm-transfer",
        },
    ]

    // Settings items for drawer
    const settingsItems = [
        {
            title: t('usersAndAccess'),
            icon: <ManageAccountsRoundedIcon/>,
            href: "/users",
            testId: "nav-item-users",
        },
        ...(currentSession?.isAdmin !== false
            ? [
                {
                    title: t('usbBackups'),
                    icon: <UsbRoundedIcon/>,
                    href: "/usb-backups",
                    testId: "nav-item-usb-backups",
                },
                {
                    title: t('runtimeExtensions'),
                    icon: <ExtensionRoundedIcon/>,
                    href: "/extensions",
                    testId: "nav-item-extensions",
                },
            ]
            : []),
        {
            title: t('servers'),
            icon: <CloudRoundedIcon/>,
            href: "/servers",
            testId: "nav-item-servers",
        }
    ]

    // Drawer contents used for permanent and temporary variant
    const drawerContent = (
        <>
            <DrawerHeader>
                <IconButton onClick={handleDrawerClose} aria-label={t('closeDrawer')}>
                    <ChevronLeftIcon/>
                </IconButton>
            </DrawerHeader>
            <Divider/>
            <List>
                {menuItems.map((item) => (
                    <Link href={scopedHref(item.href)} prefetch={false} passHref key={item.title} onClick={!isDesktop ? handleDrawerClose : null}>
                        <ListItem disablePadding sx={{display: 'block'}}>
                            <ListItemButton
                                data-testid={item.testId}
                                sx={{
                                    minHeight: 48,
                                    justifyContent: drawerOpen ? 'initial' : 'center',
                                    px: 2.5,
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: 0,
                                        mr: drawerOpen ? 2 : 'auto',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.title} sx={{opacity: drawerOpen ? 1 : 0, display: drawerOpen ? 'block' : 'none'}}/>
                            </ListItemButton>
                        </ListItem>
                    </Link>
                ))}
            </List>
            <Divider/>
            <List data-testid="custom-pages-nav">
                {navPages.map((page: PageConfig) => (
                    <Link href={scopedHref(`/custom-page/?id=${page.id}`)} passHref key={page.id} onClick={!isDesktop ? handleDrawerClose : null}>
                        <ListItem disablePadding sx={{display: 'block'}}>
                            <ListItemButton sx={{minHeight: 48, justifyContent: drawerOpen ? 'initial' : 'center', px: 2.5}}>
                                <ListItemIcon sx={{minWidth: 0, mr: drawerOpen ? 2 : 'auto', justifyContent: 'center'}}>
                                    {getPageIcon(page.icon)}
                                </ListItemIcon>
                                <ListItemText primary={page.title} sx={{opacity: drawerOpen ? 1 : 0, display: drawerOpen ? 'block' : 'none'}}/>
                            </ListItemButton>
                        </ListItem>
                    </Link>
                ))}
                <ListItem disablePadding sx={{display: 'block'}}>
                    <ListItemButton
                        onClick={() => setAddPageOpen(true)}
                        data-testid="add-page-button"
                        sx={{minHeight: 48, justifyContent: drawerOpen ? 'initial' : 'center', px: 2.5}}
                    >
                        <ListItemIcon sx={{minWidth: 0, mr: drawerOpen ? 2 : 'auto', justifyContent: 'center'}}>
                            <AddRoundedIcon/>
                        </ListItemIcon>
                        <ListItemText primary={t('addPage')} sx={{opacity: drawerOpen ? 1 : 0, display: drawerOpen ? 'block' : 'none'}}/>
                    </ListItemButton>
                </ListItem>
            </List>
            <Divider/>
            <List>
                {settingsItems.map((item) => (
                    <Link href={scopedHref(item.href)} prefetch={false} passHref key={item.title} onClick={!isDesktop ? handleDrawerClose : null}>
                        <ListItem disablePadding sx={{display: 'block'}}>
                            <ListItemButton
                                data-testid={item.testId}
                                sx={{
                                    minHeight: 48,
                                    justifyContent: drawerOpen ? 'initial' : 'center',
                                    px: 2.5,
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: 0,
                                        mr: drawerOpen ? 2 : 'auto',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.title} sx={{opacity: drawerOpen ? 1 : 0, display: drawerOpen ? 'block' : 'none'}}/>
                            </ListItemButton>
                        </ListItem>
                    </Link>
                ))}
            </List>
            <Divider/>
        </>
    )

    return (
        <Box sx={{display: 'flex', minInlineSize: 0, maxInlineSize: '100%'}}>
            <CssBaseline/>
            <AppBar
                position="fixed"
                open={drawerOpen}
                elevation={0}
                sx={{
                    backgroundColor: "background.default",
                    color: "text.primary",
                    borderBottom: sandboxStatus.sandboxMode ? "2px solid #f59e0b" : "solid",
                    borderColor: sandboxStatus.sandboxMode ? "#f59e0b" : "action.selected",
                    displayPrint: "none",
                }}
                isDesktop={isDesktop}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label={t('openDrawer')}
                        data-testid="navbar-drawer-toggle"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{
                            marginRight: 5,
                            ...(drawerOpen && {display: 'none'}),
                        }}
                    >
                        <MenuIcon/>
                    </IconButton>
                    <Stack direction="row" sx={{flex: '1 1 0%', minInlineSize: 0, gap: 1}} alignItems="center" justifyContent="space-between">
                        {/* Dark theme gets the bare mark so it sits on the bar seamlessly; light theme
                            gets the logo's own black tile, since the cream glyph vanishes on a white bar. */}
                        <Box
                            component="img"
                            src={isDarkMode ? '/icons/logo-mark.png' : '/icons/logo-mark-tile.png'}
                            alt=""
                            sx={{height: 26, width: 26, flexShrink: 0, ...(isDarkMode ? {} : {borderRadius: 1})}}
                        />
                        <Stack direction="row" spacing={1} alignItems="center" sx={{minInlineSize: 0, flexShrink: 1}}>
                            <Typography variant="h6" noWrap component="div" sx={{minInlineSize: 0, flexShrink: 1}}>
                                {t('appTitle')}
                            </Typography>
                            {sandboxStatus.sandboxMode && (
                                <Tooltip title={coachUi.sandboxBannerNote} arrow>
                                    <Chip
                                        size="small"
                                        color="warning"
                                        label={
                                            typeof sandboxStatus.remainingSeconds === "number"
                                                ? `${coachUi.sandboxBadge} · ${coachUi.ttlRemainingLabel(Math.max(1, Math.ceil(sandboxStatus.remainingSeconds / 60)))}`
                                                : coachUi.sandboxBadge
                                        }
                                        data-testid="navbar-sandbox-indicator"
                                        sx={{fontWeight: 800, flexShrink: 0}}
                                    />
                                </Tooltip>
                            )}
                            {sandboxStatus.sandboxMode && (
                                <Button
                                    size="small"
                                    variant={coachOpen ? "contained" : "outlined"}
                                    color="warning"
                                    startIcon={<SchoolRoundedIcon fontSize="small" />}
                                    onClick={() => setCoachOpen((prev) => !prev)}
                                    data-testid="navbar-training-coach-toggle"
                                    sx={{textTransform: 'none', fontWeight: 700, flexShrink: 0}}
                                >
                                    {coachUi.coachButtonLabel}
                                </Button>
                            )}
                        </Stack>
                        {/* A custom page's title and edit controls render here (empty on ORNL's pages). */}
                        <Box
                            ref={setHeaderSlot}
                            data-testid="page-header-slot"
                            sx={{display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 1, overflow: 'hidden'}}
                        />
                        {scopedViewDropdown.mode === "badge" && activeViewKey && (
                            <Chip
                                label={t('operationalViewValue', {view: activeViewKey})}
                                color="primary"
                                variant="outlined"
                                size="small"
                                data-testid="navbar-scoped-view-badge"
                                sx={{flexShrink: 0}}
                            />
                        )}
                        {scopedViewDropdown.mode === "dropdown" && (
                            <FormControl
                                size="small"
                                sx={{
                                    flexShrink: 0,
                                    minInlineSize: {xs: 136, sm: 184},
                                    maxInlineSize: {xs: 180, sm: 260},
                                }}
                            >
                                <InputLabel id={scopedViewLabelId}>{t('scopedViewMenuLabel')}</InputLabel>
                                <Select
                                    labelId={scopedViewLabelId}
                                    label={t('scopedViewMenuLabel')}
                                    value={scopedSelectValue}
                                    displayEmpty={scopedSelectValue === "" && Boolean(activeViewKey)}
                                    renderValue={
                                        scopedSelectValue === "" && activeViewKey
                                            ? () => activeViewKey
                                            : undefined
                                    }
                                    onOpen={() => {
                                        void dataSourceCtx?.refreshOperationalViews?.();
                                    }}
                                    onChange={handleScopedViewChange}
                                    data-testid="navbar-scoped-view-select"
                                    sx={{
                                        minBlockSize: "32px",
                                        "@media (pointer: coarse)": {minBlockSize: "44px"},
                                    }}
                                >
                                    {scopedViewDropdown.includeAllLanes && (
                                        <MenuItem value={ALL_LANES_SELECT_VALUE} data-testid="navbar-scoped-view-option-all">
                                            {totalCatalogLaneCount > 0
                                                ? t('scopedViewAllLanesCount', {count: totalCatalogLaneCount})
                                                : t('scopedViewAllLanes')}
                                        </MenuItem>
                                    )}
                                    {scopedViewDropdown.options.map((option) => (
                                        <MenuItem
                                            key={option.key}
                                            value={option.key}
                                            data-testid={`navbar-scoped-view-option-${option.key}`}
                                        >
                                            {typeof option.laneCount === "number"
                                                ? t('scopedViewOptionWithCount', {view: option.key, count: option.laneCount})
                                                : option.key}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                        <Stack direction="row" alignItems="center" spacing={1} sx={{flexShrink: 0}}>
                            {authenticatedUsername && (
                                <Button
                                    component={Link}
                                    prefetch={false}
                                    href={scopedHref('/users')}
                                    color="inherit"
                                    size="small"
                                    startIcon={<ManageAccountsRoundedIcon fontSize="small" />}
                                    data-testid="navbar-user-account-btn"
                                    sx={{textTransform: 'none', maxWidth: {xs: 130, sm: 260}}}
                                >
                                    <Typography variant="body2" noWrap sx={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                        {t('signedInAs', {username: currentSession?.displayName || authenticatedUsername})}
                                    </Typography>
                                </Button>
                            )}
                            {currentSession?.isReadOnly && (
                                <Chip
                                    label={t('roleViewerBadge')}
                                    size="small"
                                    color="default"
                                    variant="outlined"
                                    sx={{display: {xs: 'none', md: 'inline-flex'}}}
                                />
                            )}
                            <Button color="inherit" size="small" onClick={handleLogout}>
                                {t('logOut')}
                            </Button>
                            <LanguageSelector />
                            {!sandboxStatus.sandboxMode && (
                                <Tooltip title={coachUi.walkthroughButtonHint} arrow placement="top">
                                    <Button
                                        color={coachOpen ? "primary" : "inherit"}
                                        variant={coachOpen ? "contained" : "outlined"}
                                        size="small"
                                        startIcon={<SchoolRoundedIcon fontSize="small" aria-hidden="true" />}
                                        aria-pressed={coachOpen}
                                        aria-label={coachUi.walkthroughButtonLabel}
                                        data-testid="navbar-walkthrough-button"
                                        onClick={() => setCoachOpen((prev) => !prev)}
                                        sx={{
                                            textTransform: "none",
                                            fontWeight: 600,
                                            flexShrink: 0,
                                            minBlockSize: "34px",
                                            "@media (pointer: coarse)": { minBlockSize: "44px" },
                                            px: { xs: 1, lg: 1.25 },
                                            "& .MuiButton-startIcon": {
                                                mr: { xs: 0, lg: 0.75 },
                                                ml: 0,
                                            },
                                        }}
                                    >
                                        <Box component="span" sx={{ display: { xs: "none", lg: "inline" } }}>
                                            {coachUi.walkthroughButtonLabel}
                                        </Box>
                                    </Button>
                                </Tooltip>
                            )}
                            <Tooltip title={t('operatorHelp')} arrow placement="top">
                                <IconButton
                                    color="inherit"
                                    aria-label={t('operatorHelp')}
                                    data-testid="navbar-help-button"
                                    onClick={() => setHelpDialogOpen(true)}
                                >
                                    <HelpOutlineRoundedIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={t('settings')} arrow placement="top">
                                <IconButton
                                    id="settings-button"
                                    color="inherit"
                                    aria-label={t('openSettings')}
                                    data-testid="navbar-settings-button"
                                    onClick={handleSettingsMenuOpen}
                                >
                                    <Badge
                                        color="warning"
                                        badgeContent={(visualUnreadAlert || continuousAlarmAudio) ? unreadAlarmCount : 0}
                                        invisible={!(visualUnreadAlert || continuousAlarmAudio) || unreadAlarmCount <= 0}
                                        max={99}
                                    >
                                        <SettingsIcon aria-hidden="true" />
                                    </Badge>
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Stack>
                </Toolbar>
            </AppBar>
            <HelpDialog
                open={helpDialogOpen}
                onClose={() => setHelpDialogOpen(false)}
                onOpenGuidedWalkthrough={() => {
                    setHelpDialogOpen(false);
                    setCoachOpen(true);
                }}
                activePathname={pathname ?? undefined}
                nodes={configuredNodes}
                stateSummary={{
                    configuredNodeCount: configuredNodes.length,
                    activeViewKey: activeViewKey ?? null,
                    viewError: viewError ?? null,
                    unreadAlarmCount,
                    authenticatedUserPresent: Boolean(authenticatedUsername),
                }}
            />
            <Menu
                id="settings-menu"
                anchorEl={settingsAnchorEl}
                open={settingsMenuOpen}
                onClose={handleSettingsMenuClose}
                MenuListProps={{
                    'aria-labelledby': 'settings-button',
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                PaperProps={{
                    sx: { width: 320, maxWidth: '100%' }
                }}
            >
                <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="h6">{ t('settings') }</Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        { t('notificationPreferences') }
                    </Typography>
                    <Stack direction="column" spacing={1.5} sx={{ mt: 1.5}}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={notificationsEnabled === 'granted'}
                                    onChange={handleNotifications}
                                    size="small"
                                    disabled={notificationsEnabled === 'granted'}
                                />
                            }
                            label={
                                <Box sx={{marginLeft: 2}}>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('browserNotificationPermission')}
                                    </Typography>
                                </Box>
                            }
                        />
                        <FormControlLabel
                            sx={{alignItems: 'flex-start', m: 0}}
                            control={
                                <Switch
                                    checked={visualUnreadAlert}
                                    onChange={(_event, checked) => dispatch(setVisualUnreadAlert(checked))}
                                    size="small"
                                    inputProps={{'aria-label': t('visualUnreadAlert')}}
                                    data-testid="toggle-visual-unread-alert"
                                />
                            }
                            label={
                                <Box sx={{marginLeft: 1.5}}>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('visualUnreadAlert')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', whiteSpace: 'normal', lineHeight: 1.3}}>
                                        {t('visualUnreadAlertHint')}
                                    </Typography>
                                </Box>
                            }
                        />
                        <FormControlLabel
                            sx={{alignItems: 'flex-start', m: 0}}
                            control={
                                <Switch
                                    checked={continuousAlarmAudio}
                                    onChange={(_event, checked) => dispatch(setContinuousAlarmAudio(checked))}
                                    size="small"
                                    inputProps={{'aria-label': t('continuousAlarmAudio')}}
                                    data-testid="toggle-continuous-alarm-audio"
                                />
                            }
                            label={
                                <Box sx={{marginLeft: 1.5}}>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('continuousAlarmAudio')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', whiteSpace: 'normal', lineHeight: 1.3}}>
                                        {t('continuousAlarmAudioHint')}
                                    </Typography>
                                </Box>
                            }
                        />
                    </Stack>
                </Box>
                <Divider />
                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        {t('alarmVolume')}
                    </Typography>
                    <Stack spacing={2} direction="row" sx={{ alignItems: 'center', mt: 1.5 }}>
                        <VolumeDown fontSize="small" color="action"/>
                        <Slider
                            aria-label={t('alarmVolume')}
                            value={volumeValue}
                            onChange={handleVolumeChange}
                            valueLabelDisplay="auto"
                            min={0}
                            max={100}
                            size="small"
                        />
                        <VolumeUp fontSize="small"/>
                    </Stack>
                </Box>
            </Menu>
            {isDesktop ? (
                /* Render permanent variant for DESKTOP */
                <Drawer variant="permanent" open={drawerOpen} sx={{ displayPrint: 'none' }}>
                    {drawerContent}
                </Drawer>
            ) : (
                /* Render temporary variant for MOBILE and TABLET */
                <MuiDrawer variant="temporary" open={drawerOpen} onClose={handleDrawerClose}
                    sx={{
                        displayPrint: 'none',
                        '& .MuiDrawer-paper': {
                        width: drawerWidthMobile,
                        },
                    }}
                >
                    {drawerContent}
                </MuiDrawer>
            )}

            <Box sx={{display: "none"}}>
                <AlarmAudio/>
            </Box>
            <AddPageDialog open={addPageOpen} onClose={() => setAddPageOpen(false)}/>
            <Box
                component="main"
                sx={(theme) => ({
                    height: '100%',
                    flex: '1 1 0%',
                    minInlineSize: 0,
                    overflowX: 'clip',
                    '@media print': {
                        overflow: 'visible',
                        height: 'auto',
                    },
                    transition: theme.transitions.create(['margin-left'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.standard,
                    }),
                })}
            >
                <DrawerHeader sx={{ displayPrint: 'none' }}/>
                <Box sx={{ p: 2, minInlineSize: 0, boxSizing: 'border-box', '@media print': { p: 0 } }}>
                    {viewError && (
                        <Alert severity="error" sx={{mb: 2}}>
                            {viewError === "invalid"
                                ? t('operationalViewInvalid')
                                : viewError === "unauthorized"
                                    ? t('operationalViewUnauthorized', {view: activeViewKey ?? ''})
                                    : t('operationalViewEmpty', {view: activeViewKey ?? ''})}
                        </Alert>
                    )}
                    <HeaderSlotProvider node={headerSlot}>
                        {sandboxStatus.sandboxMode && splitAdminOpen ? (
                            <div className="oscar-sandbox-admin-split-shell" data-testid="sandbox-split-admin-shell">
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        bgcolor: "#0f172a",
                                        color: "#f8fafc",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 1,
                                        minInlineSize: 0,
                                    }}
                                >
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{minInlineSize: 0}}>
                                        <SplitscreenRoundedIcon fontSize="small" sx={{color: "#fbbf24"}} />
                                        <Typography variant="body2" fontWeight={700} noWrap>
                                            SensorHub Admin (<code>/sensorhub/admin</code>) — {coachUi.sandboxBadge}
                                        </Typography>
                                    </Stack>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="inherit"
                                        onClick={() => {
                                            setSplitAdminOpen(false);
                                            dispatchSandboxRefreshEvents({
                                                lanes: true,
                                                telemetry: true,
                                                events: true,
                                            });
                                            refreshSandboxStatus();
                                        }}
                                        data-testid="sandbox-close-split-admin-btn"
                                        sx={{textTransform: 'none', flexShrink: 0}}
                                    >
                                        {coachUi.closeSplitAdminLabel}
                                    </Button>
                                </Box>
                                <iframe
                                    title="OSCAR SensorHub Admin — Hands-On Training Sandbox"
                                    src="/sensorhub/admin"
                                    className="oscar-sandbox-admin-iframe"
                                    data-testid="sandbox-admin-iframe"
                                />
                            </div>
                        ) : (
                            children
                        )}
                    </HeaderSlotProvider>
                </Box>
            </Box>
            {coachOpen && (
                <TrainingCoachDock
                    status={sandboxStatus}
                    activePathname={pathname ?? "/"}
                    onStatusUpdated={applyNextSandboxStatus}
                    onRefreshRequested={refreshSandboxStatus}
                    onNavigateRoute={(route) => router.push(scopedHref(route))}
                    splitAdminOpen={splitAdminOpen}
                    onToggleSplitAdmin={setSplitAdminOpen}
                    onMinimize={() => setCoachOpen(false)}
                />
            )}
        </Box>
    );
}
