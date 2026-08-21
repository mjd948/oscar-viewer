import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {RootState} from "@/lib/state/Store";
import {LaneDSColl} from "@/lib/data/oscar/LaneCollection";


export interface LaneViewState {
    currentLane: string | null;
    toggleState: string
}

const initialState: LaneViewState = {
    currentLane: null,
    toggleState: "occupancy"
}

export const Slice = createSlice({
    name: 'laneView',
    initialState: initialState,
    reducers: {
        setCurrentLane: (state, action: PayloadAction<string>) =>{
            state.currentLane = action.payload;
        },
        setToggleState: (state, action: PayloadAction<string>) =>{
            state.toggleState = action.payload;
        },
    }
})

export const{
    setCurrentLane,
    setToggleState
} = Slice.actions;

export const selectCurrentLane = (state: RootState) => state.laneView.currentLane;
export const selectLastToggleState = (state: RootState) => state.laneView.toggleState;


export default Slice.reducer;