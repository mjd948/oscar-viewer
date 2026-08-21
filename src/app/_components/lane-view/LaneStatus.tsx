"use client";

import {LaneStatusType} from '../../../../types/new-types';
import React, {useContext, useEffect, useState} from 'react';

import LaneItem from './LaneItem';
import DataStreams from "osh-js/source/core/consysapi/datastream/DataStreams.js";
import ObservationFilter from "osh-js/source/core/consysapi/observation/ObservationFilter.js";
import {useLaneStreams} from "@/lib/data/oscar/streams/useLaneStreams";
import {LaneStreamRegistry} from "@/lib/data/oscar/streams/LaneStreamRegistry";
import {DataSourceContext} from "@/app/contexts/DataSourceContext";

interface LaneStatusProps {
    laneName: string;
}

export default function LaneStatus({laneName}: LaneStatusProps) {
    const [laneStatus, setLaneStatus] = useState<LaneStatusType>();
    const {laneMapRef} = useContext(DataSourceContext);

    const {laneIds} = useLaneStreams(
        {mode: 'include', lanes: laneName ? [laneName] : []},
        ['gammaRT', 'neutronRT', 'tamperRT'],
        (_laneId, stream, message) => {
            switch (stream) {
                case 'gammaRT':
                case 'neutronRT': {
                    const state = message.values[0].data.alarmState;
                    updateStatus(laneName, state);
                    break;
                }
                case 'tamperRT': {
                    const state = message.values[0].data.tamperStatus;
                    if (state) {
                        updateStatus(laneName, 'Tamper');
                    }
                    break;
                }
            }
        },
        !!laneName,
    );

    async function fetchLatestStatus() {
        // Just use gamma datasource bc all lanes should have it, and gamma "Background" state is the most common
        const gammaSources = LaneStreamRegistry.getRawDatasources(laneMapRef.current, laneName, 'gammaRT');
        const gammaDatasource = gammaSources[0];
        if (!gammaDatasource) return;

        const gammaDataStreamId = gammaDatasource.properties.resource.split('/')[2];

        const dsAPI = new DataStreams({
            endpointUrl: `${gammaDatasource.properties.endpointUrl}`,
            tls: gammaDatasource.properties.tls,
            connectorOpts: gammaDatasource.properties.connectorOpts,
            mqttOpts: gammaDatasource.properties.mqttOpts,
            streamProtocol: 'mqtt'
        });

        const gammaDataStream = await dsAPI.getDataStreamById(gammaDataStreamId);
        const latestObservationQuery = await gammaDataStream.searchObservations(new ObservationFilter({resultTime: 'latest'}), 1);
        const latestObservationArray = await latestObservationQuery.nextPage();
        const latestObservation = latestObservationArray[0];
        if (!latestObservation) return;

        const initialLaneStatus: LaneStatusType = {
            id: -1,
            name: laneName,
            status: latestObservation.result.alarmState
        }
        setLaneStatus(initialLaneStatus);
    }

    useEffect(() => {
        if (laneName && laneIds.length > 0)
            fetchLatestStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [laneName, laneIds.length]);

    /**
     * gammaRT and neutronRT both publish at ~1 Hz and almost always repeat the
     * same alarmState, so this used to re-render — and, through a
     * setLastLaneStatus dispatch into the PERSISTED laneView slice whose
     * payload carried an ever-incrementing id, rewrite localStorage — twice a
     * second per lane, forever. Nothing ever read lastLaneStatus, so the
     * dispatch is gone and only real transitions reach React.
     */
    function updateStatus(name: string, newState: string) {
        setLaneStatus((prev) =>
            prev && prev.name === name && prev.status === newState
                ? prev
                : {id: -1, name, status: newState});
    }

    return (
        <>
            {laneStatus && (
                <LaneItem key={laneStatus.name} name={laneStatus.name} status={laneStatus.status}/>
            )}
        </>
    );
}
