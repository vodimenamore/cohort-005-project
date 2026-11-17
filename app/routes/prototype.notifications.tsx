// THROWAWAY PROTOTYPE for wayfinder ticket "How should the notification inbox look and behave?" (#6).
// Never merge. Hard-coded data, no persistence. Flip the switches in the panel bottom-right.
import { useState } from "react";
import { cn } from "~/lib/utils";
import { UserAvatar } from "~/components/user-avatar";
import {
  Bell,
  BookOpen,
  LayoutDashboard,
  GraduationCap,
  MessageSquare,
  Users,
  UsersRound,
  ReceiptText,
  CircleCheck,
  CircleX,
  ShoppingCart,
  Reply,
  Ticket,
  Check,
  CheckCheck,
  Inbox,
  Settings,
} from "lucide-react";

type Role = "learner" | "instructor" | "platformAdmin" | "teamAdmin";

type Kind =
  | "refundRequested"
  | "refundApproved"
  | "refundDeclined"
  | "purchase"
  | "question"
  | "reply"
  | "couponRedeemed";

interface Note {
  id: number;
  kind: Kind;
  actor: string | null; // null = system/Platform Admin decision, no person to show
  text: React.ReactNode;
  detail?: string;
  to: string;
  ago: string;
  read: boolean;
}

const KIND_ICON: Record<Kind, React.ReactNode> = {
  refundRequested: <ReceiptText className="size-4" />,
  refundApproved: <CircleCheck className="size-4 text-green-600" />,
  refundDeclined: <CircleX className="size-4 text-red-600" />,
  purchase: <ShoppingCart className="size-4" />,
  question: <MessageSquare className="size-4" />,
  reply: <Reply className="size-4" />,
  couponRedeemed: <Ticket className="size-4" />,
};

const b = (s: string) => <strong className="font-semibold">{s}</strong>;

const DATA: Record<Role, { user: string; label: string; notes: Note[] }> = {
  learner: {
    user: "Emma Wilson",
    label: "Learner",
    notes: [
      { id: 1, kind: "refundApproved", actor: null, text: <>Your refund for {b("Building REST APIs with Node.js")} was approved: {b("$49.00")} refunded</>, to: "/dashboard", ago: "12m", read: false },
      { id: 2, kind: "reply", actor: "Sarah Chen", text: <>{b("Sarah Chen")} replied to your comment on {b("Generics Basics")}</>, detail: "“Good question! Constraints narrow T so you can…”", to: "/courses/introduction-to-typescript/lessons/…#comment-88", ago: "2h", read: false },
      { id: 3, kind: "refundDeclined", actor: null, text: <>Your refund request for {b("Design Systems with Tailwind")} was declined</>, detail: "Platform Admin note: “Outside the 30-day window — you've completed 80% of the course.”", to: "/courses/design-systems-with-tailwind", ago: "3d", read: true },
      { id: 4, kind: "reply", actor: "James Park", text: <>{b("James Park")} replied to your comment on {b("Mapped Types")}</>, to: "/courses/introduction-to-typescript/lessons/…#comment-41", ago: "1w", read: true },
    ],
  },
  instructor: {
    user: "Sarah Chen",
    label: "Instructor",
    notes: [
      { id: 1, kind: "question", actor: "Liam Thompson", text: <>{b("Liam Thompson")} asked a question on {b("Conditional Types")}</>, detail: "“Why does `infer` only work inside the extends clause?”", to: "/courses/introduction-to-typescript/lessons/…#comment-102", ago: "4m", read: false },
      { id: 2, kind: "purchase", actor: "Olivia Martinez", text: <>{b("Olivia Martinez")} enrolled in {b("Introduction to TypeScript")}</>, to: "/instructor/1/students", ago: "38m", read: false },
      { id: 3, kind: "purchase", actor: "Sophia Davis", text: <>{b("Sophia Davis")} enrolled in {b("Introduction to TypeScript")}</>, to: "/instructor/1/students", ago: "1h", read: false },
      { id: 4, kind: "reply", actor: "Emma Wilson", text: <>{b("Emma Wilson")} replied to your comment on {b("Generics Basics")}</>, detail: "“That makes sense, thanks!”", to: "/courses/introduction-to-typescript/lessons/…#comment-90", ago: "1h", read: false },
      { id: 5, kind: "purchase", actor: "James Park", text: <>{b("James Park")} enrolled in {b("Introduction to TypeScript")}</>, to: "/instructor/1/students", ago: "yesterday", read: true },
      { id: 6, kind: "question", actor: "Emma Wilson", text: <>{b("Emma Wilson")} asked a question on {b("Generics Basics")}</>, to: "/courses/introduction-to-typescript/lessons/…#comment-88", ago: "2d", read: true },
    ],
  },
  platformAdmin: {
    user: "Alex Rivera",
    label: "Platform Admin",
    notes: [
      { id: 1, kind: "refundRequested", actor: "Liam Thompson", text: <>{b("Liam Thompson")} requested a refund for {b("Practical Data Visualisation")}</>, to: "/admin/refund-requests (page does not exist yet)", ago: "9m", read: false },
      { id: 2, kind: "refundRequested", actor: "Emma Wilson", text: <>{b("Emma Wilson")} requested a refund for {b("Design Systems with Tailwind")}</>, to: "/admin/refund-requests (page does not exist yet)", ago: "3d", read: true },
    ],
  },
  teamAdmin: {
    user: "Bossy McBossface",
    label: "Team Admin",
    notes: [
      { id: 1, kind: "couponRedeemed", actor: "Priya Nair", text: <>{b("Priya Nair")} redeemed a seat for {b("Introduction to TypeScript")}</>, to: "/team", ago: "20m", read: false },
      { id: 2, kind: "couponRedeemed", actor: "Marcus Johnson", text: <>{b("Marcus Johnson")} redeemed a seat for {b("Introduction to TypeScript")}</>, to: "/team", ago: "5h", read: false },
      { id: 3, kind: "couponRedeemed", actor: "Liam Thompson", text: <>{b("Liam Thompson")} redeemed a seat for {b("Building REST APIs with Node.js")}</>, to: "/team", ago: "2d", read: true },
    ],
  },
};

const EMPTY_HINT: Record<Role, string> = {
  learner: "Replies to your comments and updates on your Refund Requests will show up here.",
  instructor: "New enrollments, questions on your lessons, and replies to your comments will show up here.",
  platformAdmin: "New Refund Requests will show up here.",
  teamAdmin: "You'll hear here when a Team Member redeems a seat.",
};

type Placement = "header" | "navItem" | "footer";
type Badge = "count" | "dot";
type Surface = "popover" | "page" | "popoverPlusPage";
type ItemLead = "avatar" | "icon";
type Unread = "dotTint" | "bold";
type MarkRead = "onClick" | "onClickPlusToggle" | "allOnOpen";
type Empty = "simple" | "roleHint";

interface Switches {
  role: Role;
  placement: Placement;
  badge: Badge;
  surface: Surface;
  lead: ItemLead;
  unread: Unread;
  markRead: MarkRead;
  markAll: boolean;
  tabs: boolean;
  closeOnClick: boolean;
  forceEmpty: boolean;
  empty: Empty;
}

export default function NotificationsPrototype() {
  const [s, setS] = useState<Switches>({
    role: "instructor",
    placement: "header",
    badge: "count",
    surface: "popoverPlusPage",
    lead: "avatar",
    unread: "dotTint",
    markRead: "onClick",
    markAll: true,
    tabs: false,
    closeOnClick: true,
    forceEmpty: false,
    empty: "roleHint",
  });
  const set = <K extends keyof Switches>(k: K, v: Switches[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  // per-role read state, resettable
  const [notes, setNotes] = useState(() =>
    Object.fromEntries(
      (Object.keys(DATA) as Role[]).map((r) => [r, DATA[r].notes.map((n) => ({ ...n }))])
    ) as Record<Role, Note[]>
  );
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"home" | "inbox">("home");
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [toast, setToast] = useState<string | null>(null);

  const mine = s.forceEmpty ? [] : notes[s.role];
  const unreadCount = mine.filter((n) => !n.read).length;

  function update(fn: (n: Note[]) => Note[]) {
    setNotes((p) => ({ ...p, [s.role]: fn(p[s.role]) }));
  }
  function markAllRead() {
    update((ns) => ns.map((n) => ({ ...n, read: true })));
  }
  function toggleRead(id: number) {
    update((ns) => ns.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));
  }
  function clickNote(n: Note) {
    update((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setToast(`Navigates to ${n.to}`);
    setTimeout(() => setToast(null), 2500);
    if (s.closeOnClick) setOpen(false);
  }
  function reset() {
    setNotes(
      Object.fromEntries(
        (Object.keys(DATA) as Role[]).map((r) => [r, DATA[r].notes.map((n) => ({ ...n }))])
      ) as Record<Role, Note[]>
    );
  }

  function onBell() {
    if (s.surface === "page") {
      setView("inbox");
      setOpen(false);
    } else {
      setOpen((o) => !o);
    }
    if (s.markRead === "allOnOpen") markAllRead();
  }

  const badgeEl =
    unreadCount === 0 ? null : s.badge === "count" ? (
      <span className="min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    ) : (
      <span className="size-2 rounded-full bg-red-600" />
    );

  const bellButton = (
    <button
      onClick={onBell}
      title="Notifications"
      className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
    >
      <Bell className="size-4" />
      {badgeEl && <span className="absolute -right-0.5 -top-0.5 flex">{badgeEl}</span>}
    </button>
  );

  const list = (
    <InboxList
      notes={mine}
      s={s}
      tab={tab}
      setTab={setTab}
      onClick={clickNote}
      onToggle={toggleRead}
      onMarkAll={markAllRead}
      unreadCount={unreadCount}
      compact={s.surface !== "page" && view !== "inbox"}
      onViewAll={
        s.surface === "popoverPlusPage"
          ? () => {
              setView("inbox");
              setOpen(false);
            }
          : undefined
      }
    />
  );

  const navItems = [
    { label: "Browse Courses", icon: <BookOpen className="size-4" /> },
    ...(s.role === "learner" ? [{ label: "Dashboard", icon: <LayoutDashboard className="size-4" /> }] : []),
    ...(s.role === "instructor" ? [{ label: "My Courses", icon: <GraduationCap className="size-4" /> }, { label: "Questions", icon: <MessageSquare className="size-4" /> }] : []),
    ...(s.role === "platformAdmin" ? [{ label: "Manage Users", icon: <Users className="size-4" /> }] : []),
    ...(s.role === "teamAdmin" ? [{ label: "Team", icon: <UsersRound className="size-4" /> }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* mock sidebar, same classes as app/components/sidebar.tsx */}
      <aside className="relative flex h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <button onClick={() => setView("home")} className="text-lg font-bold tracking-tight">
            Cadence
          </button>
          {s.placement === "header" && bellButton}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((i) => (
            <div key={i.label} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70">
              {i.icon}
              {i.label}
            </div>
          ))}
          {s.placement === "navItem" && (
            <button
              onClick={onBell}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent",
                view === "inbox" ? "bg-sidebar-accent" : "text-sidebar-foreground/70"
              )}
            >
              <Bell className="size-4" />
              Notifications
              <span className="ml-auto flex">{badgeEl}</span>
            </button>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <UserAvatar name={DATA[s.role].user} avatarUrl={null} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{DATA[s.role].user}</div>
              <div className="truncate text-xs text-sidebar-foreground/50">{DATA[s.role].label}</div>
            </div>
            {s.placement === "footer" && bellButton}
            <Settings className="size-4 text-sidebar-foreground/50" />
          </div>
        </div>

        {open && s.surface !== "page" && (
          <div
            className={cn(
              "absolute left-[calc(100%+8px)] z-20 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl",
              s.placement === "footer" ? "bottom-4" : s.placement === "navItem" ? "top-40" : "top-3"
            )}
          >
            {list}
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
        {view === "inbox" ? (
          <div className="mx-auto max-w-2xl p-8" onClick={(e) => e.stopPropagation()}>
            <h1 className="mb-4 text-2xl font-bold">Notifications</h1>
            <div className="rounded-lg border">{list}</div>
          </div>
        ) : (
          <div className="p-8 text-muted-foreground">
            <h1 className="mb-2 text-2xl font-bold text-foreground">Some page</h1>
            <p>Placeholder content. Use the bell, and flip the switches bottom-right.</p>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <SwitchPanel s={s} set={set} reset={reset} />
    </div>
  );
}

function InboxList(props: {
  notes: Note[];
  s: Switches;
  tab: "all" | "unread";
  setTab: (t: "all" | "unread") => void;
  onClick: (n: Note) => void;
  onToggle: (id: number) => void;
  onMarkAll: () => void;
  unreadCount: number;
  compact: boolean;
  onViewAll?: () => void;
}) {
  const { notes, s, tab } = props;
  const shown = s.tabs && tab === "unread" ? notes.filter((n) => !n.read) : notes;
  const visible = props.compact ? shown.slice(0, 5) : shown;

  return (
    <div>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Notifications</span>
          {s.tabs && (
            <div className="flex gap-1 text-xs">
              {(["all", "unread"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => props.setTab(t)}
                  className={cn("rounded px-2 py-0.5 capitalize", tab === t ? "bg-accent font-medium" : "text-muted-foreground")}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        {s.markAll && props.unreadCount > 0 && (
          <button onClick={props.onMarkAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <CheckCheck className="size-3.5" /> Mark all as read
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <Inbox className="mb-3 size-8 text-muted-foreground/60" />
          <div className="font-medium">
            {notes.length > 0 ? "No unread Notifications" : "You're all caught up"}
          </div>
          {s.empty === "roleHint" && notes.length === 0 && (
            <p className="mt-1 max-w-64 text-sm text-muted-foreground">{EMPTY_HINT[s.role]}</p>
          )}
        </div>
      ) : (
        <ul className={cn(props.compact && "max-h-[420px] overflow-y-auto")}>
          {visible.map((n) => (
            <li
              key={n.id}
              className={cn(
                "group relative flex cursor-pointer gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent/60",
                !n.read && s.unread === "dotTint" && "bg-primary/5"
              )}
              onClick={() => props.onClick(n)}
            >
              <div className="shrink-0 pt-0.5">
                {s.lead === "avatar" && n.actor ? (
                  <div className="relative">
                    <UserAvatar name={n.actor} avatarUrl={null} />
                    <span className="absolute -bottom-1 -right-1 rounded-full border bg-background p-0.5 [&>svg]:size-3">
                      {KIND_ICON[n.kind]}
                    </span>
                  </div>
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">{KIND_ICON[n.kind]}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm", s.unread === "bold" ? (n.read ? "text-muted-foreground [&_strong]:font-normal" : "font-medium") : !n.read ? "" : "text-muted-foreground")}>
                  {n.text}
                </div>
                {n.detail && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.detail}</div>}
                <div className="mt-1 text-xs text-muted-foreground">{n.ago}</div>
              </div>
              <div className="flex w-5 shrink-0 flex-col items-center gap-2 pt-1.5">
                {!n.read && s.unread === "dotTint" && <span className="size-2 rounded-full bg-primary" />}
                {s.markRead === "onClickPlusToggle" && (
                  <button
                    title={n.read ? "Mark as unread" : "Mark as read"}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onToggle(n.id);
                    }}
                    className="hidden rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground group-hover:block"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {props.onViewAll && (
        <button onClick={props.onViewAll} className="w-full border-t px-4 py-2 text-center text-sm text-primary hover:bg-accent/60">
          View all Notifications
        </button>
      )}
    </div>
  );
}

function SwitchPanel({
  s,
  set,
  reset,
}: {
  s: Switches;
  set: <K extends keyof Switches>(k: K, v: Switches[K]) => void;
  reset: () => void;
}) {
  const row = <K extends keyof Switches>(label: string, k: K, opts: [Switches[K], string][]) => (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">
        {opts.map(([v, l]) => (
          <button
            key={String(v)}
            onClick={() => set(k, v)}
            className={cn("rounded border px-2 py-0.5 text-xs", s[k] === v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 space-y-2.5 rounded-lg border bg-card p-3 text-card-foreground shadow-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">Prototype switches</span>
        <button onClick={reset} className="text-xs text-muted-foreground underline">reset read state</button>
      </div>
      {row("Viewing as", "role", [["learner", "Learner"], ["instructor", "Instructor"], ["platformAdmin", "Platform Admin"], ["teamAdmin", "Team Admin"]])}
      {row("1. Bell placement", "placement", [["header", "Sidebar header"], ["navItem", "Nav item"], ["footer", "By avatar"]])}
      {row("2. Unread indicator", "badge", [["count", "Count (9+)"], ["dot", "Dot"]])}
      {row("3. Surface", "surface", [["popover", "Popover only"], ["page", "Page only"], ["popoverPlusPage", "Popover + page"]])}
      {row("4a. Item leads with", "lead", [["avatar", "Actor avatar"], ["icon", "Event icon"]])}
      {row("4b. Unread item style", "unread", [["dotTint", "Dot + tint"], ["bold", "Bold vs grey"]])}
      {row("5. Click closes popover", "closeOnClick", [[true, "Yes"], [false, "No"]])}
      {row("6a. Mark read", "markRead", [["onClick", "On click"], ["onClickPlusToggle", "Click + hover toggle"], ["allOnOpen", "All on open"]])}
      {row("6b. Mark all as read", "markAll", [[true, "Shown"], [false, "Hidden"]])}
      {row("6c. All / Unread tabs", "tabs", [[true, "Shown"], [false, "Hidden"]])}
      {row("7. Empty state", "empty", [["simple", "Just “caught up”"], ["roleHint", "+ what lands here"]])}
      {row("Force empty inbox", "forceEmpty", [[true, "Empty"], [false, "Data"]])}
    </div>
  );
}
