import { useState, useEffect, useRef, useCallback } from 'react';
import { joinRoom } from 'trystero/torrent';

const APP_ID = 'hardhat-studio-collab';

const ROOM_CONFIG = {
  appId: APP_ID,
  trackerUrls: [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.files.fm:7073/announce',
    'wss://open.tracker.cl/announce',
  ],
};

export type CollabRole = 'host' | 'guest';
export type CollabStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface CollabSharedState {
  deployedContracts: unknown[];
  abis: unknown[];
  rpcUrl: string;
  txHistory: unknown[];
  projectName: string;
  networkName: string;
  lanIp: string | null;
}

export interface GuestIssue {
  id: string;
  contractName: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  peerId: string;
  receivedAt: number;
}

export interface CollabMessage {
  id: string;
  from: 'host' | 'guest';
  peerId: string;
  text: string;
  sentAt: number;
}

export function useCollabSession() {
  const latestStateRef = useRef<CollabSharedState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [role, setRole] = useState<CollabRole | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [peerCount, setPeerCount] = useState(0);
  const [status, setStatus] = useState<CollabStatus>('idle');
  const [guestIssues, setGuestIssues] = useState<GuestIssue[]>([]);
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [receivedState, setReceivedState] = useState<CollabSharedState | null>(null);

  const roomRef = useRef<ReturnType<typeof joinRoom> | null>(null);
  const sendStateRef = useRef<((data: unknown, peerId?: string) => void) | null>(null);
  const sendIssueRef = useRef<((data: unknown) => void) | null>(null);
  const sendMessageRef = useRef<((data: unknown) => void) | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRoleRef = useRef<CollabRole | null>(null);

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    try { roomRef.current?.leave(); } catch { }
    roomRef.current = null;
    sendStateRef.current = null;
    sendIssueRef.current = null;
    sendMessageRef.current = null;
    currentRoleRef.current = null;
    setSessionId(null);
    setRole(null);
    setPeers([]);
    setPeerCount(0);
    setStatus('idle');
    setError(null);
    setReceivedState(null);
    setGuestIssues([]);
    setMessages([]);
  }, []);

  const startSession = useCallback((initialState: CollabSharedState): string => {
    cleanup();

    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    currentRoleRef.current = 'host';
    setSessionId(id);
    setRole('host');
    setStatus('connecting');
    setError(null);

    try {
      const room = joinRoom(ROOM_CONFIG, id);
      roomRef.current = room;

      const [sendState, getState] = room.makeAction('state');
      const [sendIssue, getIssue] = room.makeAction('issue');
      const [sendMsg, getMsg] = room.makeAction('message');
      const [, getPing] = room.makeAction('ping');

      sendStateRef.current = sendState as (data: unknown, peerId?: string) => void;
      sendIssueRef.current = sendIssue as (data: unknown) => void;
      sendMessageRef.current = sendMsg as (data: unknown) => void;
      latestStateRef.current = initialState; // seed awal

      room.onPeerJoin((peerId) => {
        setPeers((prev) => {
          const next = [...prev, peerId];
          setPeerCount(next.length);
          return next;
        });
        setStatus('connected');
        // Kirim state terbaru, bukan stale initialState
        const stateToSend = latestStateRef.current ?? initialState;
        (sendState as (data: unknown, target: string) => void)(stateToSend, peerId);
      });

      room.onPeerLeave((peerId) => {
        setPeers((prev) => {
          const next = prev.filter((p) => p !== peerId);
          setPeerCount(next.length);
          if (next.length === 0) setStatus('connecting');
          return next;
        });
      });

      (getIssue as (cb: (data: unknown, peerId: string) => void) => void)(
        (data, peerId) => {
          const issue = data as Omit<GuestIssue, 'peerId' | 'receivedAt'>;
          setGuestIssues((prev) => [
            { ...issue, peerId, receivedAt: Date.now() },
            ...prev.slice(0, 49),
          ]);
        },
      );

      (getMsg as (cb: (data: unknown, peerId: string) => void) => void)(
        (data, peerId) => {
          const msg = data as Omit<CollabMessage, 'peerId' | 'from'>;
          setMessages((prev: any) => [...prev, { ...msg, peerId, from: 'guest' }].slice(-100));
        },
      );

      (getState as (cb: (data: unknown) => void) => void)(() => { });
      (getPing as (cb: (data: unknown) => void) => void)(() => { });

    } catch (e) {
      setError(String(e));
      setStatus('error');
    }

    return id;
  }, [cleanup]);

  const joinSession = useCallback((id: string): void => {
    cleanup();

    const roomId = id.toUpperCase();
    currentRoleRef.current = 'guest';
    setSessionId(roomId);
    setRole('guest');
    setStatus('connecting');
    setError(null);

    try {
      const room = joinRoom(ROOM_CONFIG, roomId);
      roomRef.current = room;

      const [, getState] = room.makeAction('state');
      const [sendIssue] = room.makeAction('issue');
      const [sendMsg, getMsg] = room.makeAction('message');
      const [sendPing] = room.makeAction('ping');

      sendIssueRef.current = sendIssue as (data: unknown) => void;
      sendMessageRef.current = sendMsg as (data: unknown) => void;

      room.onPeerJoin((peerId) => {
        setPeers((prev) => {
          const next = [...prev, peerId];
          setPeerCount(next.length);
          return next;
        });
        setStatus('connected');
      });

      room.onPeerLeave((peerId) => {
        setPeers((prev) => {
          const next = prev.filter((p) => p !== peerId);
          setPeerCount(next.length);
          if (next.length === 0) setStatus('connecting');
          return next;
        });
      });

      (getState as (cb: (data: unknown) => void) => void)((data) => {
        const state = data as CollabSharedState;
        const fixedState: CollabSharedState = {
          ...state,
          rpcUrl: state.lanIp
            ? `http://${state.lanIp}:8545`
            : state.rpcUrl,
        };
        setReceivedState(fixedState);
        setStatus('connected');
      });

      (getMsg as (cb: (data: unknown, peerId: string) => void) => void)(
        (data, peerId) => {
          const msg = data as Omit<CollabMessage, 'peerId' | 'from'>;
          setMessages((prev: any) => [...prev, { ...msg, peerId, from: 'host' }].slice(-100));
        },
      );

      pingIntervalRef.current = setInterval(() => {
        try { (sendPing as (data: unknown) => void)({}); } catch { }
      }, 30_000);

    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }, [cleanup]);

  const syncState = useCallback((state: CollabSharedState): void => {
    latestStateRef.current = state;
    if (currentRoleRef.current !== 'host') return;
    if (!sendStateRef.current || peerCount === 0) return;
    try { (sendStateRef.current as (data: unknown) => void)(state); } catch { }
  }, [peerCount]);

  const sendIssue = useCallback((issue: {
    contractName: string;
    message: string;
    severity?: 'info' | 'warning' | 'error';
  }): void => {
    if (currentRoleRef.current !== 'guest') return;
    if (!sendIssueRef.current) return;
    try {
      (sendIssueRef.current as (data: unknown) => void)({
        id: crypto.randomUUID(),
        severity: 'info',
        ...issue,
        sentAt: Date.now(),
      });
    } catch { }
  }, []);

  const sendMessage = useCallback((text: string): void => {
    if (!sendMessageRef.current || !currentRoleRef.current) return;
    const msg = { id: crypto.randomUUID(), text, sentAt: Date.now() };
    try {
      (sendMessageRef.current as (data: unknown) => void)(msg);
      setMessages((prev) => [
        ...prev,
        { ...msg, peerId: 'self', from: currentRoleRef.current! },
      ].slice(-100));
    } catch { }
  }, []);

  const dismissIssue = useCallback((issueId: string): void => {
    setGuestIssues((prev) => prev.filter((i) => i.id !== issueId));
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    sessionId, role, peers, peerCount, status, error,
    guestIssues, messages, receivedState,
    startSession, joinSession, syncState,
    sendIssue, sendMessage, dismissIssue,
    endSession: cleanup,
  };
}