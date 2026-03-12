import { useState, useEffect, useRef } from 'react';
import {
  Users,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Radio,
  AlertTriangle,
  X,
  Send,
  Globe,
  Play,
  MessageCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  useCollabSession,
  CollabSharedState,
  GuestIssue,
  CollabMessage,
} from '../../hooks/useCollabSession';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface CollabPanelProps {
  deployedContracts: unknown[];
  abis: unknown[];
  rpcUrl: string;
  txHistory: unknown[];
  projectName: string;
  onRunCollabNode: () => void;
  onEndCollabNode: () => void;
  isNodeRunning: boolean;
  onHostStart?: () => void;
  onGuestJoin?: () => void;
  onReceiveContracts?: (contracts: unknown[]) => void;
  onReceiveAbis?: (abis: unknown[]) => void;
  onReceiveRpcUrl?: (url: string) => void;
  onReceiveTxHistory?: (history: unknown[]) => void;
}

type NodeStatus = 'unknown' | 'checking' | 'running' | 'not-running';

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        status === 'connected' && 'bg-green-500 animate-pulse',
        status === 'connecting' && 'bg-yellow-500 animate-pulse',
        status === 'error' && 'bg-red-500',
        status === 'idle' && 'bg-muted-foreground',
      )}
    />
  );
}

function IssueCard({ issue, onDismiss }: { issue: GuestIssue; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-3 rounded-lg border text-xs',
        issue.severity === 'error' && 'border-red-500/30 bg-red-500/5',
        issue.severity === 'warning' && 'border-yellow-500/30 bg-yellow-500/5',
        issue.severity === 'info' && 'border-blue-500/30 bg-blue-500/5',
      )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle
            className={cn(
              'w-3 h-3 shrink-0',
              issue.severity === 'error' && 'text-red-500',
              issue.severity === 'warning' && 'text-yellow-500',
              issue.severity === 'info' && 'text-blue-500',
            )}
          />
          <span className="font-mono font-semibold text-foreground">{issue.contractName}</span>
        </div>
        <button
          onClick={onDismiss}
          className="transition-colors text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
      <p className="pl-4 leading-relaxed text-muted-foreground">{issue.message}</p>
      <span className="pl-4 text-muted-foreground/50">
        {new Date(issue.receivedAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

function ChatBubble({ msg, myRole }: { msg: CollabMessage; myRole: 'host' | 'guest' }) {
  const isMine = msg.peerId === 'self';
  return (
    <div className={cn('flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'px-3 py-1.5 rounded-xl text-xs max-w-[80%] leading-relaxed',
          isMine
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}>
        {msg.text}
      </div>
      <span className="text-[10px] text-muted-foreground/40 px-1">
        {isMine ? (myRole === 'host' ? 'you (host)' : 'you (guest)') : msg.from}
        {' · '}
        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

// Node status + port picker component for host
function NodePortSection({
  isNodeRunning,
  onRunCollabNode,
  lanIp,
}: {
  isNodeRunning: boolean;
  onRunCollabNode: () => void;
  lanIp: string | null;
}) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('unknown');
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [customPort, setCustomPort] = useState('8545');
  const [checkingPort, setCheckingPort] = useState(false);
  const [showPortInput, setShowPortInput] = useState(false);

  const autoDetect = async () => {
    setNodeStatus('checking');
    setCheckingPort(true);
    try {
      const result = await window.api.detectHardhatNode();
      if (result.found && result.port) {
        setNodeStatus('running');
        setDetectedPort(result.port);
        setCustomPort(String(result.port));
      } else {
        setNodeStatus('not-running');
        setDetectedPort(null);
      }
    } catch {
      setNodeStatus('not-running');
    } finally {
      setCheckingPort(false);
    }
  };

  const checkCustomPort = async () => {
    const port = parseInt(customPort);
    if (isNaN(port) || port < 1 || port > 65535) return;
    setCheckingPort(true);
    try {
      const result = await window.api.checkHardhatPort(port);
      setNodeStatus(result.running ? 'running' : 'not-running');
      setDetectedPort(result.running ? port : null);
    } catch {
      setNodeStatus('not-running');
    } finally {
      setCheckingPort(false);
    }
  };

  // Auto-detect on mount
  useEffect(() => {
    if (isNodeRunning) {
      setNodeStatus('running');
      setDetectedPort(8545);
    } else {
      autoDetect();
    }
  }, [isNodeRunning]);

  const hardhatHostCmd = `npx hardhat node --hostname 0.0.0.0`;
  const lanRpcUrl = lanIp && detectedPort ? `http://${lanIp}:${detectedPort}` : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Node status banner */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 p-3 rounded-lg border text-xs',
          nodeStatus === 'running' && 'border-green-500/30 bg-green-500/5',
          nodeStatus === 'not-running' && 'border-yellow-500/30 bg-yellow-500/5',
          nodeStatus === 'checking' && 'border-blue-500/30 bg-blue-500/5',
          nodeStatus === 'unknown' && 'border-border bg-muted/20',
        )}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              nodeStatus === 'running' && 'bg-green-500 animate-pulse',
              nodeStatus === 'not-running' && 'bg-yellow-500',
              nodeStatus === 'checking' && 'bg-blue-500 animate-pulse',
              nodeStatus === 'unknown' && 'bg-muted-foreground',
            )}
          />
          <span
            className={cn(
              nodeStatus === 'running' && 'text-green-400',
              nodeStatus === 'not-running' && 'text-yellow-400',
              nodeStatus === 'checking' && 'text-blue-400',
              nodeStatus === 'unknown' && 'text-muted-foreground',
            )}>
            {nodeStatus === 'running' && `Node detected on port ${detectedPort} — LAN ready`}
            {nodeStatus === 'not-running' && 'No Hardhat node detected'}
            {nodeStatus === 'checking' && 'Scanning for Hardhat node...'}
            {nodeStatus === 'unknown' && 'Node status unknown'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={autoDetect}
            disabled={checkingPort}
            className="transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Re-scan">
            <RefreshCw className={cn('w-3 h-3', checkingPort && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowPortInput((v) => !v)}
            className="transition-colors text-muted-foreground hover:text-foreground"
            title="Manual port">
            <Search className="w-3 h-3" />
          </button>
          {nodeStatus === 'not-running' && (
            <Button
              size="sm"
              onClick={onRunCollabNode}
              className="h-6 text-[10px] gap-1 bg-yellow-600 hover:bg-yellow-500 text-white border-0">
              <Play className="w-3 h-3" /> Start
            </Button>
          )}
        </div>
      </div>

      {/* Manual port input */}
      {showPortInput && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Port:</span>
          <input
            value={customPort}
            onChange={(e) => setCustomPort(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') checkCustomPort();
            }}
            placeholder="8545"
            className="flex-1 px-2 py-1 font-mono text-xs border rounded-md bg-muted/40 border-border focus:outline-none focus:border-blue-500/50"
          />
          <Button
            size="sm"
            onClick={checkCustomPort}
            disabled={checkingPort}
            className="h-6 text-[10px] bg-blue-600 hover:bg-blue-500 text-white border-0">
            Check
          </Button>
        </div>
      )}

      {/* LAN RPC info when node is running */}
      {nodeStatus === 'running' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border font-mono text-xs">
            <code className="flex-1 text-green-400 break-all">{hardhatHostCmd}</code>
          </div>
          {lanRpcUrl && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 font-mono text-xs">
              <Wifi className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <code className="flex-1 text-blue-400 break-all">{lanRpcUrl}</code>
              <button
                onClick={() => navigator.clipboard.writeText(lanRpcUrl)}
                className="text-muted-foreground hover:text-foreground shrink-0">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CollabPanel({
  deployedContracts,
  abis,
  rpcUrl,
  txHistory,
  projectName,
  onReceiveContracts,
  onReceiveAbis,
  onReceiveRpcUrl,
  onReceiveTxHistory,
  isNodeRunning,
  onRunCollabNode,
  onEndCollabNode,
  onHostStart,
  onGuestJoin,
}: CollabPanelProps) {
  const {
    sessionId,
    role,
    peerCount,
    status,
    error,
    guestIssues,
    messages,
    receivedState,
    startSession,
    joinSession,
    syncState,
    sendIssue,
    sendMessage,
    dismissIssue,
    endSession,
  } = useCollabSession();

  const [lanIp, setLanIp] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'pick' | 'host' | 'guest'>('pick');
  const [activeView, setActiveView] = useState<'info' | 'chat' | 'issues'>('info');

  // Issue form
  const [issueContract, setIssueContract] = useState('');
  const [issueMessage, setIssueMessage] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<'info' | 'warning' | 'error'>('info');
  const [issueSent, setIssueSent] = useState(false);

  // Chat
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Unread tracking
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadIssues, setUnreadIssues] = useState(0);
  const prevMsgCount = useRef(0);
  const prevIssueCount = useRef(0);

  useEffect(() => {
    window.api.getLanIp().then(setLanIp);
  }, []);

  useEffect(() => {
    if (messages.length > prevMsgCount.current && activeView !== 'chat') {
      setUnreadMessages((n) => n + (messages.length - prevMsgCount.current));
    }
    prevMsgCount.current = messages.length;
  }, [messages, activeView]);

  useEffect(() => {
    if (guestIssues.length > prevIssueCount.current && activeView !== 'issues') {
      setUnreadIssues((n) => n + (guestIssues.length - prevIssueCount.current));
    }
    prevIssueCount.current = guestIssues.length;
  }, [guestIssues, activeView]);

  useEffect(() => {
    if (activeView === 'chat') setUnreadMessages(0);
    if (activeView === 'issues') setUnreadIssues(0);
  }, [activeView]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!receivedState) return;
    console.log('[Collab] receivedState:', {
      contracts: receivedState.deployedContracts?.length,
      abis: receivedState.abis?.length,
      rpcUrl: receivedState.rpcUrl,
    });
    onReceiveContracts?.(receivedState.deployedContracts ?? []);
    onReceiveAbis?.(receivedState.abis ?? []);
    onReceiveRpcUrl?.(receivedState.rpcUrl);
    onReceiveTxHistory?.(receivedState.txHistory ?? []);
  }, [receivedState, onReceiveContracts, onReceiveAbis, onReceiveRpcUrl, onReceiveTxHistory]);

  // Host: auto-sync state changes
  useEffect(() => {
    if (role !== 'host' || status !== 'connected') return;
    syncState({
      deployedContracts,
      abis,
      rpcUrl,
      txHistory: txHistory.slice(0, 50),
      projectName,
      networkName: '',
      lanIp,
    });
  }, [deployedContracts, abis, rpcUrl, txHistory, role, status, lanIp, peerCount]);

  const handleStartHost = () => {
    setMode('host');
    onHostStart?.();
    startSession({
      deployedContracts,
      abis,
      rpcUrl,
      txHistory: txHistory.slice(0, 50),
      projectName,
      networkName: '',
      lanIp,
    });
  };

  const handleJoin = () => {
    if (joinCode.trim().length < 4) return;
    setMode('guest');
    onGuestJoin?.();
    joinSession(joinCode.trim());
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendIssue = () => {
    if (!issueContract.trim() || !issueMessage.trim()) return;
    sendIssue({ contractName: issueContract, message: issueMessage, severity: issueSeverity });
    setIssueMessage('');
    setIssueSent(true);
    setTimeout(() => setIssueSent(false), 2000);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleEnd = () => {
    onEndCollabNode();
    endSession();
    setMode('pick');
    setJoinCode('');
    setActiveView('info');
  };

  //  PICK MODE
  if (mode === 'pick') {
    return (
      <div className="flex flex-col h-full gap-6 p-6">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Collab Session</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Share your local Hardhat network and contracts in real-time. Pure P2P, no server needed.
          </p>
        </div>
        {lanIp && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/40 border-border">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-xs text-muted-foreground">
              LAN IP: <span className="text-foreground">{lanIp}</span>
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleStartHost}
            className="flex flex-col gap-3 p-4 text-left transition-all border rounded-xl border-border hover:border-violet-500/50 hover:bg-violet-500/5 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
              <Radio className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold transition-colors text-foreground group-hover:text-violet-400">
                Host Session
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Share contracts & network. Get a code for your team.
              </p>
            </div>
          </button>
          <button
            onClick={() => setMode('guest')}
            className="flex flex-col gap-3 p-4 text-left transition-all border rounded-xl border-border hover:border-blue-500/50 hover:bg-blue-500/5 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold transition-colors text-foreground group-hover:text-blue-400">
                Join Session
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Enter a code from host to sync contracts & network.
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  //  GUEST JOIN INPUT
  if (mode === 'guest' && !sessionId) {
    return (
      <div className="flex flex-col h-full gap-4 p-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('pick')}
            className="transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-foreground">Join Session</h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enter the 6-character session code from the host.
        </p>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="A3F9K2"
            maxLength={6}
            className="flex-1 px-3 py-2 font-mono text-lg tracking-widest text-center uppercase border rounded-lg bg-muted/40 border-border focus:outline-none focus:border-blue-500/50"
          />
          <Button
            onClick={handleJoin}
            disabled={joinCode.trim().length < 4}
            className="text-white bg-blue-600 border-0 hover:bg-blue-500">
            Join
          </Button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  //  ACTIVE SESSION
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-xs font-semibold capitalize text-foreground">
            {role} — {status}
          </span>
          {peerCount > 0 && (
            <span className="text-xs text-muted-foreground">
              · {peerCount} peer{peerCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleEnd}
          className="px-2 text-xs h-7 text-muted-foreground hover:text-red-400">
          End
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {[
          { key: 'info', label: 'Info' },
          { key: 'chat', label: 'Chat', badge: unreadMessages },
          {
            key: 'issues',
            label: role === 'host' ? 'Issues' : 'Report',
            badge: role === 'host' ? unreadIssues : 0,
          },
        ].map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as typeof activeView)}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2',
              activeView === key
                ? 'text-foreground border-orange-500'
                : 'text-muted-foreground border-transparent hover:text-foreground',
            )}>
            {label}
            {badge != null && badge > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-orange-500 text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/*  INFO TAB  */}
        {activeView === 'info' && (
          <div className="flex flex-col flex-1 gap-4 p-4 overflow-y-auto">
            {/* Session code (host) */}
            {role === 'host' && sessionId && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Share this code:</p>
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/40 border-border">
                  <span className="flex-1 font-mono text-xl font-bold tracking-widest text-foreground">
                    {sessionId}
                  </span>
                  <button
                    onClick={() => handleCopy(sessionId)}
                    className="transition-colors text-muted-foreground hover:text-foreground">
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Node port detection (host only) */}
            {role === 'host' && (
              <NodePortSection
                isNodeRunning={isNodeRunning}
                onRunCollabNode={onRunCollabNode}
                lanIp={lanIp}
              />
            )}

            {/* Synced state summary (guest) */}
            {role === 'guest' && receivedState && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Synced from host:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Contracts', value: receivedState.deployedContracts.length },
                    { label: 'ABIs', value: receivedState.abis.length },
                    { label: 'Project', value: receivedState.projectName || '—' },
                    {
                      label: 'Network',
                      value: receivedState.lanIp ? `${receivedState.lanIp}:8545` : '—',
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2.5 rounded-lg bg-muted/40 border border-border">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-xs font-semibold text-foreground font-mono mt-0.5">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                {receivedState.lanIp && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 font-mono text-xs">
                    <Wifi className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <code className="flex-1 text-blue-400 break-all">
                      http://{receivedState.lanIp}:8545
                    </code>
                    <button
                      onClick={() => handleCopy(`http://${receivedState.lanIp}:8545`)}
                      className="text-muted-foreground hover:text-foreground shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'connecting' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Waiting for peer to connect...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-400 border rounded-lg bg-red-500/5 border-red-500/30">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/*  CHAT TAB  */}
        {activeView === 'chat' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 gap-2 p-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
                  <MessageCircle className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/50">No messages yet. Say hi!</p>
                </div>
              )}
              {messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} myRole={role!} />
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 p-3 border-t border-border shrink-0">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                disabled={status !== 'connected'}
                className="flex-1 px-3 py-1.5 text-xs border rounded-lg bg-muted/40 border-border focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || status !== 'connected'}
                className="gap-1 text-xs text-white bg-blue-600 border-0 hover:bg-blue-500">
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/*  ISSUES TAB  */}
        {activeView === 'issues' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 gap-3 p-4 overflow-y-auto">
              {role === 'guest' && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-foreground">Report issue to host</p>
                  <input
                    value={issueContract}
                    onChange={(e) => setIssueContract(e.target.value)}
                    placeholder="Contract name e.g. MyToken"
                    className="px-3 py-2 font-mono text-xs border rounded-lg bg-muted/40 border-border focus:outline-none focus:border-blue-500/50"
                  />
                  <textarea
                    value={issueMessage}
                    onChange={(e) => setIssueMessage(e.target.value)}
                    placeholder="Describe the issue..."
                    rows={3}
                    className="px-3 py-2 text-xs border rounded-lg resize-none bg-muted/40 border-border focus:outline-none focus:border-blue-500/50"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={issueSeverity}
                      onChange={(e) =>
                        setIssueSeverity(e.target.value as 'info' | 'warning' | 'error')
                      }
                      className="text-xs bg-muted/40 border border-border rounded-lg px-2 py-1.5 focus:outline-none">
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                    <Button
                      size="sm"
                      onClick={handleSendIssue}
                      disabled={
                        !issueContract.trim() || !issueMessage.trim() || status !== 'connected'
                      }
                      className={cn(
                        'ml-auto gap-1.5 text-xs border-0 text-white',
                        issueSent
                          ? 'bg-green-600 hover:bg-green-500'
                          : 'bg-blue-600 hover:bg-blue-500',
                      )}>
                      {issueSent ? (
                        <>
                          <Check className="w-3 h-3" /> Sent!
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3" /> Send
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {role === 'host' &&
                (guestIssues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2 py-8 text-center">
                    <AlertTriangle className="w-8 h-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground/50">No issues reported yet.</p>
                  </div>
                ) : (
                  guestIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onDismiss={() => dismissIssue(issue.id)}
                    />
                  ))
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
