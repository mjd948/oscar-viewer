/*
 * Copyright (c) 2024.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {configureStore, combineReducers, createStore} from "@reduxjs/toolkit";
import storage from "redux-persist/lib/storage";
import { persistStore, persistReducer, createTransform } from "redux-persist";
import { FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import AppReducer from './Slice';
import OSHReducer from './OSHSlice';
import EventDataReducer from './EventDataSlice';
import OSCARClientReducer from "@/lib/state/OSCARClientSlice";
import OSCARLaneReducer from "@/lib/state/OSCARLaneSlice";
import EventDetailsReducer from "@/lib/state/EventDetailsSlice";
import EventPreviewReducer from "@/lib/state/EventPreviewSlice";
import LaneViewReducer from "@/lib/state/LaneViewSlice";
import PageLayoutReducer from "@/lib/state/PageLayoutSlice";
import LaneStatusReducer from "@/lib/state/LaneStatusSlice";

const persistConfig = {
    key: 'root',
    storage,
    // Deliberately NOT persisted:
    //  - laneSlice holds a Map of live osh-js ConSysApi objects. JSON.stringify
    //    of a Map is '{}', so it persisted nothing useful while rehydrating
    //    laneMap as a plain object — the reason convertToMap() has to be
    //    sprinkled through EventTable/MapComponent/useMobileDetectors.
    //    OSCARLaneSlice now also refuses inbound rehydrate outright.
    //  - eventLogSlice holds a selectedEvent snapshot that is stale the moment
    //    the page reloads, and setAlarmTrigger dirties it from realtime traffic.
    //    (The event-details page reads eventPreview, which IS still persisted.)
    whitelist: ['oscarClientSlice', 'eventPreview', 'laneView', "eventDetails", 'pageLayoutSlice', 'laneStatusSlice'],
    // NOTE: deliberately NO `throttle`. It was tried (1000ms) to coalesce
    // redux-persist@5's full-blob rewrites, but the write amplification it was
    // aimed at came from lane-view/LaneStatus dispatching setLastLaneStatus on
    // every realtime message — that dispatch is gone, and what remains is
    // user-paced. A throttle only buys burst coalescing now, and it costs real
    // durability: EventTableColumnResize/Reorder caught it, because a layout
    // reset or a column drag was still unwritten a second later. Persisting
    // user settings promptly is worth more than the saved rewrites.
    version: 1,
}

const rootReducer = combineReducers({
    oscarClientSlice: OSCARClientReducer,
    appState: AppReducer,
    oshSlice: OSHReducer,
    eventLogSlice: EventDataReducer,
    laneSlice: OSCARLaneReducer,
    eventPreview: EventPreviewReducer,
    laneView: LaneViewReducer,
    eventDetails: EventDetailsReducer,
    pageLayoutSlice: PageLayoutReducer,
    laneStatusSlice: LaneStatusReducer,
});


const persistedReducer = persistReducer(persistConfig, rootReducer);


export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        //     serializableCheck: {
        //         ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
        //     }
        }),
});

export const persistor = persistStore(store);


//if you make changes to the slices call this function
// persistor.purge();

export type AppStore = typeof store
// // Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// // Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch
