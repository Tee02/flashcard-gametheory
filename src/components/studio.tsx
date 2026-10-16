import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Library,
  Search,
  Shuffle,
  X,
} from "lucide-react";
import {
  cards,
  cardsIn,
  choicesFor,
  groups,
  modelById,
  models,
  type Card,
} from "@/lib/deck";
import { boxLabel, useProgress, type Grade } from "@/lib/progress";

type View = "map" | "study" | "quiz";

function shuffle<T>(list: T[]): T[] {
  const all = [...list];
  for (let n = all.length - 1; n > 0; n -= 1) {
    const j = Math.floor(Math.random() * (n + 1));
    const swap = all[n]!;
    all[n] = all[j]!;
    all[j] = swap;
  }
  return all;
}

function useHydratedProgress() {
  const stats = useProgress((s) => s.stats);
  const grade = useProgress((s) => s.grade);
  const reset = useProgress((s) => s.reset);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.resolve(useProgress.persist.rehydrate()).finally(() => setReady(true));
  }, []);

  return { stats: ready ? stats : {}, grade, reset, ready };
}

export function Studio() {
  const { stats, grade, reset, ready } = useHydratedProgress();
  const [view, setView] = useState<View>("map");
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<"run" | "done">("run");
  const [session, setSession] = useState<Record<string, Grade>>({});
  const [deckTitle, setDeckTitle] = useState("全部卡片");
  const [quiz, setQuiz] = useState<QuizRound | null>(null);
  const [armReset, setArmReset] = useState(false);

  const mastered = cards.filter((c) => (stats[c.id]?.box ?? 0) >= 3).length;
  const familiar = cards.filter((c) => (stats[c.id]?.box ?? 0) >= 2).length;

  function openDeck(ids: string[], title: string) {
    const unique = ids.filter((id, i) => ids.indexOf(id) === i);
    setQueue(shuffle(unique));
    setIndex(0);
    setFlipped(false);
    setPhase(unique.length ? "run" : "done");
    setSession({});
    setDeckTitle(title);
    setView("study");
  }

  function openDue() {
    const due = cards.filter((c) => (stats[c.id]?.box ?? 0) < 2).map((c) => c.id);
    openDeck(due.length ? due : cards.map((c) => c.id), due.length ? "今日待复习" : "全部再过一遍");
  }

  function openLapses() {
    const ids = cards
      .filter((c) => (stats[c.id]?.lapses ?? 0) > 0 && (stats[c.id]?.box ?? 0) < 3)
      .map((c) => c.id);
    openDeck(ids, "还没掌握的卡");
  }

  function startQuiz(pool: Card[], title: string) {
    const picked = shuffle(pool).slice(0, Math.min(10, pool.length));
    setQuiz({
      title,
      items: picked.map((card) => ({ card, choices: choicesFor(card), picked: null })),
      cursor: 0,
      done: false,
    });
    setView("quiz");
  }

  const current = queue[index] ? cards.find((c) => c.id === queue[index]) : undefined;

  function give(g: Grade) {
    if (!current) return;
    grade(current.id, g);
    setSession((prev) => ({ ...prev, [current.id]: g }));
    if (index + 1 >= queue.length) {
      setPhase("done");
      setFlipped(false);
      return;
    }
    setIndex((n) => n + 1);
    setFlipped(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (view !== "study" || phase !== "run" || !current) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((n) => Math.min(queue.length - 1, n + 1));
        setFlipped(false);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((n) => Math.max(0, n - 1));
        setFlipped(false);
      } else if (flipped && (event.key === "1" || event.key === "2" || event.key === "3")) {
        event.preventDefault();
        give(event.key === "1" ? "again" : event.key === "2" ? "hard" : "good");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!armReset) return;
    const timer = window.setTimeout(() => setArmReset(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armReset]);

  const sessionCounts = {
    again: Object.values(session).filter((g) => g === "again").length,
    hard: Object.values(session).filter((g) => g === "hard").length,
    good: Object.values(session).filter((g) => g === "good").length,
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-5 sm:px-6">
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-widest text-cinnabar">十八模型 · 策略闪卡</p>
            <h1 className="mt-1 text-4xl text-ink sm:text-5xl">博弈闪记</h1>
          </div>
          <div className="rounded-2xl border border-line bg-card px-4 py-3 text-right">
            <p className="text-xs text-muted">已掌握</p>
            <p className="font-serif text-2xl tabular-nums text-ink">
              {ready ? mastered : "–"}
              <span className="text-base text-muted">/{cards.length}</span>
            </p>
          </div>
        </div>
        <nav className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-paper-deep p-1">
          <Tab
            active={view === "map"}
            onClick={() => setView("map")}
            icon={<Library className="size-4" aria-hidden />}
            label="模型"
          />
          <Tab
            active={view === "study"}
            onClick={() => {
              if (!queue.length) openDue();
              else setView("study");
            }}
            icon={<BookOpen className="size-4" aria-hidden />}
            label="闪卡"
          />
          <Tab
            active={view === "quiz"}
            onClick={() => {
              if (!quiz) startQuiz(cards, "随机十题");
              else setView("quiz");
            }}
            icon={<Brain className="size-4" aria-hidden />}
            label="自测"
          />
        </nav>
      </header>

      {view === "map" ? (
        <MapView
          query={query}
          setQuery={setQuery}
          stats={stats}
          familiar={familiar}
          onOpenModel={(id) => {
            const model = modelById(id);
            openDeck(
              cardsIn(id).map((c) => c.id),
              model.title,
            );
          }}
          onOpenCard={(card) => {
            const ids = cardsIn(card.modelId).map((c) => c.id);
            const rest = shuffle(ids.filter((id) => id !== card.id));
            setQueue([card.id, ...rest]);
            setIndex(0);
            setFlipped(false);
            setPhase("run");
            setSession({});
            setDeckTitle(modelById(card.modelId).title);
            setView("study");
          }}
          onDue={openDue}
          onLapses={openLapses}
          onQuiz={() => startQuiz(cards, "随机十题")}
          onReset={() => {
            if (!armReset) {
              setArmReset(true);
              return;
            }
            reset();
            setArmReset(false);
          }}
          armReset={armReset}
        />
      ) : null}

      {view === "study" ? (
        <StudyView
          title={deckTitle}
          queue={queue}
          index={index}
          flipped={flipped}
          phase={phase}
          current={current}
          statsBox={current ? (stats[current.id]?.box ?? 0) : 0}
          sessionCounts={sessionCounts}
          onFlip={() => setFlipped((value) => !value)}
          onPrev={() => {
            setIndex((n) => Math.max(0, n - 1));
            setFlipped(false);
          }}
          onNext={() => {
            setIndex((n) => Math.min(queue.length - 1, n + 1));
            setFlipped(false);
          }}
          onGrade={give}
          onBack={() => setView("map")}
          onAgain={() => {
            const missed = Object.entries(session)
              .filter(([, g]) => g !== "good")
              .map(([id]) => id);
            openDeck(missed.length ? missed : queue, `${deckTitle} · 再看一遍`);
          }}
          onShuffle={() => openDeck(queue, deckTitle)}
        />
      ) : null}

      {view === "quiz" && quiz ? (
        <QuizView
          round={quiz}
          setRound={setQuiz}
          onBack={() => setView("map")}
          onRetryWrong={() => {
            const wrong = quiz.items.filter((item) => item.picked !== item.card.a).map((item) => item.card);
            startQuiz(wrong.length ? wrong : quiz.items.map((item) => item.card), "错题再测");
          }}
          onNew={() => startQuiz(cards, "随机十题")}
          onAnswer={(id, correct) => grade(id, correct ? "good" : "again")}
        />
      ) : null}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium " +
        (active ? "bg-ink text-paper" : "text-muted")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function MapView({
  query,
  setQuery,
  stats,
  familiar,
  onOpenModel,
  onOpenCard,
  onDue,
  onLapses,
  onQuiz,
  onReset,
  armReset,
}: {
  query: string;
  setQuery: (value: string) => void;
  stats: Record<string, { box: number; lapses: number }>;
  familiar: number;
  onOpenModel: (id: string) => void;
  onOpenCard: (card: Card) => void;
  onDue: () => void;
  onLapses: () => void;
  onQuiz: () => void;
  onReset: () => void;
  armReset: boolean;
}) {
  const needle = query.trim();
  const hits = useMemo(() => {
    if (!needle) return [];
    return cards.filter((card) => {
      const model = modelById(card.modelId);
      const blob = `${model.title}${card.kicker}${card.q}${card.a}${card.detail}`;
      return blob.includes(needle);
    });
  }, [needle]);

  const lapseCount = cards.filter((c) => (stats[c.id]?.lapses ?? 0) > 0 && (stats[c.id]?.box ?? 0) < 3).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-line bg-card p-5 sm:p-7">
        <p className="max-w-2xl text-base text-ink">
          把十八个博弈模型和开篇基础收成可以翻转的卡片。先看情境，自己答一句，再翻面核对策略。记得住就标记，含糊的留到下一轮。
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onDue}
            className="h-12 rounded-2xl bg-cinnabar px-5 text-sm font-medium text-cinnabar-ink"
          >
            开始今日复习
          </button>
          <button
            type="button"
            onClick={onQuiz}
            className="h-12 rounded-2xl border border-line bg-paper px-5 text-sm font-medium text-ink"
          >
            随机自测十题
          </button>
          <button
            type="button"
            onClick={onLapses}
            disabled={lapseCount === 0}
            className="h-12 rounded-2xl border border-line bg-paper px-5 text-sm font-medium text-ink disabled:opacity-40"
          >
            错题 {lapseCount}
          </button>
        </div>
        <p className="mt-4 text-sm text-muted">
          熟悉及以上 {familiar} 张。进度只留在这台设备上。
          <button type="button" onClick={onReset} className="ml-3 underline decoration-line underline-offset-4">
            {armReset ? "再点一次，确认清空" : "清空进度"}
          </button>
        </p>
      </section>

      <label className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4">
        <Search className="size-4 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索模型、故事或策略，例如 纳什、沉没成本"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </label>

      {needle ? (
        <section>
          <h2 className="mb-3 text-xl">搜到 {hits.length} 张</h2>
          {hits.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">没有匹配的卡片。试试模型名，或故事里的人。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {hits.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCard(card)}
                    className="flex w-full flex-col gap-1 rounded-2xl border border-line bg-card px-4 py-3 text-left"
                  >
                    <span className="text-xs text-cinnabar">
                      {modelById(card.modelId).title} · {card.kicker}
                    </span>
                    <span className="text-sm text-ink">{card.q}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        groups.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-xl">{group}</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {models
                .filter((model) => model.group === group)
                .map((model) => {
                  const deck = cardsIn(model.id);
                  const done = deck.filter((c) => (stats[c.id]?.box ?? 0) >= 3).length;
                  const ratio = deck.length ? done / deck.length : 0;
                  return (
                    <li key={model.id}>
                      <button
                        type="button"
                        onClick={() => onOpenModel(model.id)}
                        className="flex h-full w-full flex-col gap-3 rounded-3xl border border-line bg-card p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="seal text-sm">{model.no}</span>
                          <span className="text-xs tabular-nums text-muted">
                            {done}/{deck.length} 掌握
                          </span>
                        </div>
                        <div>
                          <h3 className="text-2xl">{model.title}</h3>
                          <p className="mt-1 text-sm text-muted">{model.blurb}</p>
                        </div>
                        <div className="progress-track" aria-hidden>
                          <div className="progress-fill" style={{ width: `${ratio * 100}%` }} />
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function StudyView({
  title,
  queue,
  index,
  flipped,
  phase,
  current,
  statsBox,
  sessionCounts,
  onFlip,
  onPrev,
  onNext,
  onGrade,
  onBack,
  onAgain,
  onShuffle,
}: {
  title: string;
  queue: string[];
  index: number;
  flipped: boolean;
  phase: "run" | "done";
  current: Card | undefined;
  statsBox: 0 | 1 | 2 | 3;
  sessionCounts: { again: number; hard: number; good: number };
  onFlip: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGrade: (g: Grade) => void;
  onBack: () => void;
  onAgain: () => void;
  onShuffle: () => void;
}) {
  if (!queue.length || phase === "done") {
    return (
      <section className="rounded-3xl border border-line bg-card p-6 sm:p-8">
        <button type="button" onClick={onBack} className="mb-6 text-sm text-muted">
          返回模型
        </button>
        <h2 className="text-3xl">{queue.length ? "这组看完了" : "这组还没有卡片"}</h2>
        {queue.length ? (
          <ul className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Count label="记住" value={sessionCounts.good} tone="pine" />
            <Count label="含糊" value={sessionCounts.hard} tone="gold" />
            <Count label="忘了" value={sessionCounts.again} tone="cinnabar" />
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">先在模型里选一组，或从今日复习开始。</p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {sessionCounts.again + sessionCounts.hard > 0 ? (
            <button type="button" onClick={onAgain} className="h-12 rounded-2xl bg-cinnabar px-5 text-sm font-medium text-cinnabar-ink">
              再看没记住的
            </button>
          ) : null}
          {queue.length ? (
            <button type="button" onClick={onShuffle} className="h-12 rounded-2xl border border-line px-5 text-sm font-medium text-ink">
              再洗一次
            </button>
          ) : null}
          <button type="button" onClick={onBack} className="h-12 rounded-2xl border border-line px-5 text-sm font-medium text-ink">
            回到模型
          </button>
        </div>
      </section>
    );
  }

  if (!current) return null;
  const model = modelById(current.modelId);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm text-muted">
          返回
        </button>
        <p className="truncate text-sm text-ink">{title}</p>
        <p className="shrink-0 text-sm tabular-nums text-muted">
          {index + 1}/{queue.length}
        </p>
      </div>
      <div className="progress-track" aria-hidden>
        <div className="progress-fill" style={{ width: `${((index + (flipped ? 0.5 : 0)) / queue.length) * 100}%` }} />
      </div>

      <div className="deck-scene">
        <div className={flipped ? "deck-inner is-flipped" : "deck-inner"}>
          <article className="deck-face flex flex-col gap-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-wide text-cinnabar">
                {model.title} · {current.kicker}
              </span>
              <span className="text-xs text-muted">{boxLabel[statsBox]}</span>
            </div>
            <h2 className="text-2xl leading-snug sm:text-3xl">{current.q}</h2>
            <p className="mt-auto text-sm text-muted">先在心里答一句，再翻转核对。</p>
          </article>
          <article className="deck-face deck-back flex flex-col gap-4 rounded-3xl border border-pine bg-pine-soft p-5 sm:p-7">
            <span className="text-xs tracking-wide text-pine">{current.kicker}</span>
            <h2 className="text-2xl leading-snug text-ink">{current.a}</h2>
            <p className="text-sm leading-relaxed text-ink">{current.detail}</p>
          </article>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          className="flex h-12 items-center justify-center gap-1 rounded-2xl border border-line bg-card text-sm disabled:opacity-40"
        >
          <ArrowLeft className="size-4" aria-hidden />
          上一张
        </button>
        <button
          type="button"
          onClick={onFlip}
          className="h-12 rounded-2xl bg-ink text-sm font-medium text-paper"
        >
          {flipped ? "翻回题目" : "翻转答案"}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={index === queue.length - 1}
          className="flex h-12 items-center justify-center gap-1 rounded-2xl border border-line bg-card text-sm disabled:opacity-40"
        >
          下一张
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>

      <div className={flipped ? "grid grid-cols-3 gap-2" : "grid grid-cols-3 gap-2 opacity-40"}>
        <button
          type="button"
          disabled={!flipped}
          onClick={() => onGrade("again")}
          className="h-12 rounded-2xl bg-cinnabar text-sm font-medium text-cinnabar-ink disabled:cursor-not-allowed"
        >
          忘了
        </button>
        <button
          type="button"
          disabled={!flipped}
          onClick={() => onGrade("hard")}
          className="h-12 rounded-2xl border border-line bg-card text-sm font-medium text-ink disabled:cursor-not-allowed"
        >
          含糊
        </button>
        <button
          type="button"
          disabled={!flipped}
          onClick={() => onGrade("good")}
          className="h-12 rounded-2xl bg-pine text-sm font-medium text-pine-ink disabled:cursor-not-allowed"
        >
          记住
        </button>
      </div>
      <p className="text-center text-xs text-muted">空格翻转 · 左右方向键换卡 · 翻开后按 1 / 2 / 3 评分</p>
      <button type="button" onClick={onShuffle} className="mx-auto flex items-center gap-2 text-sm text-muted">
        <Shuffle className="size-4" aria-hidden />
        重洗这组
      </button>
    </section>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: "pine" | "gold" | "cinnabar" }) {
  const color = tone === "pine" ? "text-pine" : tone === "gold" ? "text-gold" : "text-cinnabar";
  return (
    <li className="rounded-2xl border border-line bg-paper px-2 py-3">
      <p className={`font-serif text-3xl tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </li>
  );
}

type QuizItem = { card: Card; choices: string[]; picked: string | null };
type QuizRound = { title: string; items: QuizItem[]; cursor: number; done: boolean };

function QuizView({
  round,
  setRound,
  onBack,
  onRetryWrong,
  onNew,
  onAnswer,
}: {
  round: QuizRound;
  setRound: (round: QuizRound) => void;
  onBack: () => void;
  onRetryWrong: () => void;
  onNew: () => void;
  onAnswer: (id: string, correct: boolean) => void;
}) {
  const item = round.items[round.cursor];
  const correctCount = round.items.filter((entry) => entry.picked === entry.card.a).length;
  const answered = round.items.filter((entry) => entry.picked).length;

  if (round.done || !item) {
    return (
      <section className="rounded-3xl border border-line bg-card p-6 sm:p-8">
        <button type="button" onClick={onBack} className="mb-6 text-sm text-muted">
          返回模型
        </button>
        <h2 className="text-3xl">这轮自测结束</h2>
        <p className="mt-3 font-serif text-5xl tabular-nums text-ink">
          {correctCount}
          <span className="text-2xl text-muted">/{round.items.length}</span>
        </p>
        <p className="mt-2 text-sm text-muted">{round.title}。错题可以立刻再测一遍。</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {correctCount < round.items.length ? (
            <button type="button" onClick={onRetryWrong} className="h-12 rounded-2xl bg-cinnabar px-5 text-sm font-medium text-cinnabar-ink">
              只测错题
            </button>
          ) : null}
          <button type="button" onClick={onNew} className="h-12 rounded-2xl border border-line px-5 text-sm font-medium text-ink">
            再来十题
          </button>
        </div>
      </section>
    );
  }

  const revealed = item.picked !== null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm text-muted">
          返回
        </button>
        <p className="text-sm text-ink">{round.title}</p>
        <p className="text-sm tabular-nums text-muted">
          {round.cursor + 1}/{round.items.length}
        </p>
      </div>
      <article className="rounded-3xl border border-line bg-card p-5 sm:p-7">
        <p className="text-xs text-cinnabar">
          {modelById(item.card.modelId).title} · {item.card.kicker}
        </p>
        <h2 className="mt-3 text-2xl leading-snug">{item.card.q}</h2>
      </article>
      <ul className="flex flex-col gap-2">
        {item.choices.map((choice, choiceIndex) => {
          const letter = "甲乙丙丁"[choiceIndex] ?? "";
          const isCorrect = choice === item.card.a;
          const isPicked = choice === item.picked;
          let tone = "border-line bg-card text-ink";
          if (revealed && isCorrect) tone = "border-pine bg-pine-soft text-ink";
          else if (revealed && isPicked && !isCorrect) tone = "border-cinnabar bg-cinnabar-soft text-ink";
          return (
            <li key={choice}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => {
                  const items = round.items.map((entry, entryIndex) =>
                    entryIndex === round.cursor ? { ...entry, picked: choice } : entry,
                  );
                  setRound({ ...round, items });
                  onAnswer(item.card.id, choice === item.card.a);
                }}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm disabled:cursor-default ${tone}`}
              >
                <span className="mt-0.5 font-serif text-base text-cinnabar">{letter}</span>
                <span className="flex-1 leading-relaxed">{choice}</span>
                {revealed && isCorrect ? <Check className="mt-0.5 size-4 shrink-0 text-pine" aria-hidden /> : null}
                {revealed && isPicked && !isCorrect ? <X className="mt-0.5 size-4 shrink-0 text-cinnabar" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {revealed ? (
        <div className="rounded-3xl border border-line bg-paper-deep p-5">
          <p className="text-sm leading-relaxed text-ink">{item.card.detail}</p>
          <button
            type="button"
            onClick={() => {
              if (round.cursor + 1 >= round.items.length) setRound({ ...round, done: true });
              else setRound({ ...round, cursor: round.cursor + 1 });
            }}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-medium text-paper sm:w-auto sm:px-6"
          >
            {round.cursor + 1 >= round.items.length ? "看结果" : "下一题"}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted">已答对 {correctCount} · 已作答 {answered}</p>
      )}
    </section>
  );
}
