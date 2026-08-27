/*
 * Copyright (c) 2024.  Botts Innovative Research, Inc.
 * All Rights Reserved
 */

import {
    Box,
    Button,
    Card,
    Checkbox,
    Container,
    FormControlLabel, Snackbar, SnackbarCloseReason,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import React, {useEffect, useState} from "react";
import {addNode, selectNodes, updateNode} from "@/lib/state/OSHSlice";
import {registerUpstreams} from "@/lib/config/RuntimeConfig";
import {INode, Node, NodeOptions} from "@/lib/data/osh/Node";
import {useAppDispatch} from "@/lib/state/Hooks";
import {useSelector} from "react-redux";
import {useLanguage} from "@/app/contexts/LanguageContext";


export default function NodeForm({isEditNode, modeChangeCallback, editNode}: {
    isEditNode: boolean,
    modeChangeCallback?: (editMode: boolean, editNode: INode | null) => void
    editNode?: INode
}) {

    const [openSnack, setOpenSnack] = useState(false);
    const [nodeSnackMsg, setNodeSnackMsg] = useState("");
    const [colorStatus, setColorStatus] = useState("");

    const dispatch = useAppDispatch();
    const nodes = useSelector(selectNodes);
    const { t } = useLanguage();

    const newNodeOpts: NodeOptions = {
        name: "",
        address: "localhost",
        port: 8282,
        oshPathRoot: "/sensorhub",
        csAPIEndpoint: "/api",
        auth: {username: "", password: ""},
        isSecure: false,
        isDefaultNode: false
    };
    // Lazy: a bare `useState(new Node(...))` reruns the constructor on every render and
    // throws the result away, and a Node is not cheap - it builds four osh-js API clients.
    const [newNode, setNewNode] = useState<INode>(() => new Node(newNodeOpts));

    // The port is held as text for as long as the box is being edited. Parsing on every
    // keystroke turns a momentarily empty box into NaN, and a Node normalises an unusable
    // port to the default for its scheme - so clearing the field to retype it would snap
    // the value to 443 under the cursor.
    const [portText, setPortText] = useState<string>(String(newNodeOpts.port));

    useEffect(() => {
        const node = isEditNode && editNode ? editNode : new Node(newNodeOpts);
        setNewNode(node);
        setPortText(String(node.port));
    }, [isEditNode, editNode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value, checked} = e.target;

        // The edit is applied to the options and the Node is built once, at the end.
        // Constructing first and assigning onto the instance looked equivalent but was not:
        // the constructor is where the id and the four osh-js API clients are derived, and
        // each client freezes its base url and its credentials right there
        // (ConnectedSystemsApi sets this.url once and baseUrl() returns it forever). A Node
        // mutated afterwards reported the new address through its getters while every
        // actual fetch still went to the old one - so a saved edit appeared to succeed and
        // then quietly kept talking to the previous host with the previous password.
        //
        // Copying auth also keeps the assignment off the object held in the store, which
        // would otherwise show the change before Save and survive Cancel.
        const opts: NodeOptions = {...newNode, auth: {...newNode.auth}};

        if (name === "username") {
            opts.auth.username = value;
        } else if (name === "password") {
            opts.auth.password = value;
        } else if (name === "isSecure") {
            opts.isSecure = checked;
        } else if (name === "port") {
            setPortText(value);
            const parsed = Number.parseInt(value, 10);
            // An empty or half-typed box is not a new port: keep the last good one so the
            // node keeps a usable address while the operator retypes.
            if (Number.isNaN(parsed)) return;
            opts.port = parsed;
        } else if (name === 'address'){
            opts.address = value;
        } else{
            (opts as any)[name] = value;
        }

        setNewNode(new Node(opts));

    };

    const handleButtonAction = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEditNode) {
            // The id is derived from the address and port, so it changes the moment either
            // is edited; the id the form opened with is the only stable handle on the row
            // being replaced.
            dispatch(updateNode({previousId: editNode?.id ?? newNode.id, node: newNode}));
            modeChangeCallback(false, null);
        } else {
            const hasDuplicate = nodes.some(
                (n: INode) => n.address === newNode.address && n.port === newNode.port
            );
            if (hasDuplicate) {
                setNodeSnackMsg(`Node with address ${newNode.address}:${newNode.port} already exists`);
                setColorStatus('error');
                setOpenSnack(true);
                return;
            }
            const nameExists = nodes.some((n: INode) => n.name === newNode.name);
            if (nameExists) {
                setNodeSnackMsg(`Node with name "${newNode.name}" already exists`);
                setColorStatus('error');
                setOpenSnack(true);
                return;
            }

            dispatch(addNode(newNode));
            setNodeSnackMsg(`Node "${newNode.name}" added successfully`);
            setColorStatus('success');
            setOpenSnack(true);
            modeChangeCallback(false, null);
        }
    }

    const handleAddSave = async(e: React.FormEvent)=> {

        let reachable = await checkReachable(newNode)
        setOpenSnack(true)

        // checkReachable has already said why, and its reason is the useful one: a
        // rejected credential reads very differently from an unreachable address.
        if(!reachable) return;

        setNodeSnackMsg(t('nodeReachable'))
        setColorStatus('success')
        setOpenSnack(true);

        // update the list of nodes using the edit/update
        handleButtonAction(e);
    }

    if (!newNode) {
        return <Container><Typography variant="h4" align="center">Loading...</Typography></Container>
    }

    const handleCloseSnack = (
        event: React.SyntheticEvent | Event,
        reason?: SnackbarCloseReason,
    ) => {
        if (reason === 'clickaway') {
            return;
        }

        setOpenSnack(false);
    };

    async function checkReachable(node: any){
        setNodeSnackMsg(t('tryingToConnect'))
        setColorStatus('info')
        setOpenSnack(true)


        // In the desktop client this probe does not go to the node: nodeTransport routes
        // it through the local server as /__oscar/u/<node id>, and that server only knows
        // the ids it has been told about - which are the ids of the *saved* nodes. A node
        // being added has never been registered, and neither has an edited one, since the
        // id is derived from the address and port. The probe answered 502, the save was
        // refused, and the Servers page could not introduce the very node it exists to
        // introduce. Registering the candidate first closes that loop; it is a no-op in a
        // browser, where the request goes straight to the node.
        await registerUpstreams([...nodes, node] as any);

        const endpoint = `${node.getConnectedSystemsEndpoint()}`;

        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // No Authorization header at all when no credentials have been entered,
                // rather than a Basic header encoding two empty strings.
                ...node.getBasicAuthHeader()
            },
            mode: 'cors',
        }

        try {
            const response = await fetch(endpoint, options);
            if (response.ok) {
                setNodeSnackMsg(`Successfully connected to server at ${node.address}`);
                setColorStatus('success')
                return true;
            } else if (response.status === 401 || response.status === 403) {
                // The server answered, so the address and port are right. Sending the
                // operator off to check them would be a wild goose chase.
                setNodeSnackMsg(`Server at ${node.address} rejected these credentials.`);
                setColorStatus('error')
                return false;
            } else {
                // In the desktop client a 502 is usually this app's own proxy rather than
                // the node - a certificate it would not verify reports itself this way -
                // and its body is the only place the actual reason appears. Showing the
                // status alone turned "the certificate could not be verified" into a bare
                // "answered 502", which named neither the problem nor the fix and sent
                // operators to inspect a node that was running the whole time.
                //
                // Only text/plain, which is what the proxy sends: a node behind nginx
                // answers an error with a page, and pasting HTML into a snackbar helps
                // nobody.
                const reason = response.headers.get('content-type')?.startsWith('text/plain')
                    ? (await response.text().catch(() => "")).trim()
                    : "";
                setNodeSnackMsg(reason
                    ? `Connection failed. ${reason}`
                    : `Connection failed. Server at ${node.address} answered ${response.status}.`);
                setColorStatus('error')
                return false;
            }

        } catch (error) {
            setNodeSnackMsg('Connection failed. Confirm IP, port, and server availability.');
            setColorStatus('error')
            return false;
        }
    }

    return (
        <Card sx={{width: '100%'}}>
            <Typography
                variant="h4"
                align="left"
                sx={{margin: 2}}
            >
                {
                    isEditNode ? t('editNode')  : t('addServer')
                }
            </Typography>

            <Box component="form" sx={{margin: 2}}>
                <Stack spacing={4}>
                    {isEditNode ? <Typography variant={"h6"}>Editing Node: {editNode.id}</Typography> : null}
                    <TextField label={t('name')} name="name" value={newNode.name} onChange={handleChange}/>
                    <TextField label={t('address')} name="address" value={newNode.address} onChange={handleChange}/>
                    <TextField label={t('port')} name="port" value={portText} onChange={handleChange}/>
                    <TextField
                        label={t('csApiEndpoint')}
                        name="csAPIEndpoint"
                        value={newNode.csAPIEndpoint}
                        onChange={handleChange}
                    />
                    <TextField label={t('username')} name="username" value={newNode.auth?.username ?? ""} onChange={handleChange}/>
                    <TextField label={t('password')} name="password" type={"password"} value={newNode.auth?.password ?? ""}
                               onChange={handleChange}/>

                    <FormControlLabel control={<Checkbox name="isSecure" checked={newNode.isSecure} onChange={handleChange}/>} label={t('isSecure')}/>

                    <Stack direction="row" spacing={2}>
                        <Button variant={"contained"} color={"primary"}
                                onClick={handleAddSave}>{isEditNode ? t('saveChanges') : t('addNode')}</Button>
                        <Button variant={"outlined"} color={"secondary"}
                                onClick={() => modeChangeCallback(false, null)}>{t('cancel')}</Button>
                    </Stack>


                    <Snackbar
                        id="saveNode-snackbar"
                        open={openSnack}
                        anchorOrigin={{ vertical:'top', horizontal:'center' }}
                        // A failure now explains itself - a rejected certificate names the
                        // setting that would accept it - and five seconds is not long
                        // enough to read a sentence that long before it disappears.
                        autoHideDuration={colorStatus === 'error' ? 15000 : 5000}
                        onClose={handleCloseSnack}
                        message={nodeSnackMsg}
                        sx={{
                            '& .MuiSnackbarContent-root': {
                                backgroundColor: colorStatus === 'success' ? 'green' : colorStatus === 'error' ? 'red' : 'orange',
                            },
                        }}
                    />

                </Stack>
            </Box>
        </Card>
    )
}
