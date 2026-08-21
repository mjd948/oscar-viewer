import {LaneMapEntry, LaneMeta} from "@/lib/data/oscar/LaneCollection";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {RootState} from "@/lib/state/Store";
import {enableMapSet} from "immer";
import {REHYDRATE} from "redux-persist";

enableMapSet();


export interface IOSCARLaneSlice{
    lanes: LaneMeta[],
    laneMap: Map<string, LaneMapEntry>,
    oscarService: any[]
}

const initialState: IOSCARLaneSlice ={
    lanes: [],
    laneMap: new Map<string, LaneMapEntry>(),
    oscarService: []
}


export const Slice = createSlice({
    name: 'ClientLaneSlice',
    initialState,
    reducers: {
        setLanes: (state, action: PayloadAction<LaneMeta[]>) => {
            state.lanes = action.payload;
        },
        setLaneMap: (state, action: PayloadAction<Map<string, LaneMapEntry>>) => {
            state.laneMap = (action.payload);
        },
        setOscarService: (state, action: PayloadAction<[]>) => {
            state.oscarService = (action.payload);
        },
    },
    extraReducers: (builder) => {
        builder.addMatcher(
            (action): action is PayloadAction<any> => action.type === REHYDRATE,
            (state) => {
                // Never take a persisted lane map. laneMap holds live osh-js
                // ConSysApi instances; anything that survived JSON is at best a
                // plain object masquerading as a Map (breaking .get/.size) and
                // at worst datasources with no worker behind them. The real map
                // is rebuilt by DataSourceProvider on every boot, so the
                // correct inbound value is always "ignore".
                //
                // This slice is off the persist whitelist too, but persist:root
                // blobs written before that change still carry a laneSlice key,
                // and redux-persist's reconciler merges whatever keys it finds
                // without re-checking the whitelist.
                //
                // Returning a NEW object is the whole mechanism, not a style
                // choice: autoMergeLevel2 skips a key only when the reducer
                // changed that substate's identity while handling REHYDRATE
                // (`originalState[key] !== reducedState[key]`). Returning
                // `state` unchanged would let it shallow-merge the stale
                // laneMap straight back in. Same trick as LaneStatusSlice.
                return {...state};
            }
        );
    }
})


export const {
    setLanes,
    setLaneMap,
    setOscarService

} = Slice.actions;

export const selectLanes = (state: RootState) => state.laneSlice.lanes;
export const selectOscarService = (state: RootState) => state.laneSlice.oscarService;

export const selectLaneByName = (laneName: string) => (state: RootState) => {
    return state.laneSlice.lanes.find((lane: { name: string }) => lane.name === laneName);
}
export const selectLaneMap = (state: RootState) => state.laneSlice.laneMap;

export const selectLaneById = (laneId: string) => (state: RootState) => {
    return state.laneSlice.lanes.find((lane: { id: string }) => lane.id === laneId);
};

export default Slice.reducer;