"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { assetsManifest } from "./assets.manifest";
import { readClientBetaDeviceProfile } from "./beta-device-client";
import type {
  AccessibilityAnswers,
  AccessibilityReview,
  BetaDeviceProfile,
  BetaTextScale,
} from "./beta-device-server";
import {
  betaFeedbackCategories,
  type BetaFeedbackCategory,
} from "./feedback-rules";
import type {
  PartnerTaskMode,
  PublicTaskPreference,
} from "./task-preferences";

type TaskTab =
  | "wall"
  | "mine"
  | "surveys"
  | "guide"
  | "accessibility"
  | "feedback";

type AccessibilityDraft = Record<keyof AccessibilityAnswers, boolean | null>;

type PersonalFeedback = {
  category: string;
  createdAt: number;
  id: string;
  message: string;
  rating: number;
  status: string;
};

const categoryLabels: Record<BetaFeedbackCategory, string> = {
  interface: "Interface e leitura",
  racks: "Racks e mineradores",
  economy: "Economia e pools",
  minigames: "Minigames",
  tasks: "Tarefas e monetização",
};

const feedbackStatusLabels: Record<string, string> = {
  new: "Recebido",
  reviewing: "Em análise",
  planned: "Planejado",
  resolved: "Resolvido",
};

export function TasksView({
  onboardingStage,
  onNavigate,
  textScale,
}: {
  onboardingStage: number;
  onNavigate: (target: "career" | "games") => void;
  textScale: BetaTextScale;
}) {
  const [tab, setTab] = useState<TaskTab>("wall");
  const [category, setCategory] =
    useState<BetaFeedbackCategory>("interface");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<PersonalFeedback[]>([]);
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "loading" | "sending"
  >("loading");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [taskPreference, setTaskPreference] =
    useState<PublicTaskPreference | null>(null);
  const [preferenceState, setPreferenceState] = useState<
    "idle" | "loading" | "saving"
  >("loading");
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [deviceProfile, setDeviceProfile] =
    useState<BetaDeviceProfile | null>(null);
  const [accessibilityReview, setAccessibilityReview] =
    useState<AccessibilityReview | null>(null);
  const [accessibilityAnswers, setAccessibilityAnswers] =
    useState<AccessibilityDraft>({
      controlsEasy: null,
      motionComfortable: null,
      rackClear: null,
      textReadable: null,
    });
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [accessibilityState, setAccessibilityState] = useState<
    "idle" | "loading" | "saving"
  >("loading");
  const [accessibilityMessage, setAccessibilityMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/feedback", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string;
          submissions?: PersonalFeedback[];
        };
        if (!response.ok) throw new Error(data.error ?? "Feedback indisponível.");
        if (active) setFeedback(data.submissions ?? []);
      })
      .catch((error: unknown) => {
        if (active) {
          setFeedbackMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar seus envios.",
          );
        }
      })
      .finally(() => {
        if (active) setFeedbackState("idle");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/beta-device", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string;
          profile?: BetaDeviceProfile | null;
          review?: AccessibilityReview | null;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Avaliação de acesso indisponível.");
        }
        if (!active) return;
        setDeviceProfile(data.profile ?? null);
        setAccessibilityReview(data.review ?? null);
        if (data.review) {
          setAccessibilityAnswers({
            controlsEasy: data.review.controlsEasy,
            motionComfortable: data.review.motionComfortable,
            rackClear: data.review.rackClear,
            textReadable: data.review.textReadable,
          });
          setAccessibilityNotes(data.review.notes);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAccessibilityMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível abrir a avaliação de acesso.",
          );
        }
      })
      .finally(() => {
        if (active) setAccessibilityState("idle");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/task-preferences", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string;
          preference?: PublicTaskPreference;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Preferência indisponível.");
        }
        if (active) setTaskPreference(data.preference ?? null);
      })
      .catch((error: unknown) => {
        if (active) {
          setPreferenceMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar sua preferência.",
          );
        }
      })
      .finally(() => {
        if (active) setPreferenceState("idle");
      });
    return () => {
      active = false;
    };
  }, []);

  async function savePreference(partnerTasksMode: PartnerTaskMode) {
    setPreferenceState("saving");
    setPreferenceMessage("");
    try {
      const response = await fetch("/api/task-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerTasksMode }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        preference?: PublicTaskPreference;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Preferência recusada.");
      }
      setTaskPreference(data.preference ?? null);
      setPreferenceMessage(data.message ?? "Preferência salva.");
    } catch (error) {
      setPreferenceMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar sua preferência.",
      );
    } finally {
      setPreferenceState("idle");
    }
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackState("sending");
    setFeedbackMessage("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message,
          page: "tasks",
          rating,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        submissions?: PersonalFeedback[];
      };
      if (!response.ok) throw new Error(data.error ?? "Envio recusado.");
      setFeedback(data.submissions ?? []);
      setFeedbackMessage(data.message ?? "Feedback enviado.");
      setMessage("");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Não foi possível enviar.",
      );
    } finally {
      setFeedbackState("idle");
    }
  }

  async function submitAccessibilityReview(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const entries = Object.entries(accessibilityAnswers);
    if (entries.some(([, answer]) => answer === null)) {
      setAccessibilityMessage("Responda os quatro itens antes de salvar.");
      return;
    }
    setAccessibilityState("saving");
    setAccessibilityMessage("");
    try {
      const profile = readClientBetaDeviceProfile(textScale);
      const response = await fetch("/api/beta-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit-accessibility-review",
          answers: accessibilityAnswers,
          notes: accessibilityNotes,
          onboardingStage,
          ...profile,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        profile?: BetaDeviceProfile | null;
        review?: AccessibilityReview | null;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Avaliação recusada pelo servidor.");
      }
      setDeviceProfile(data.profile ?? null);
      setAccessibilityReview(data.review ?? null);
      setAccessibilityMessage(data.message ?? "Avaliação salva.");
    } catch (error) {
      setAccessibilityMessage(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setAccessibilityState("idle");
    }
  }

  return (
    <section className="tasks-view">
      <div className="tasks-hero">
        <figure>
          <img
            src="/og-tasks-beta.png"
            alt="Central de Tarefas do Crypto Miner Arcadia em um laboratório pixel art"
          />
        </figure>
        <div>
          <span>ARCADIA TASK CENTER</span>
          <h2>Tarefas em uma área própria</h2>
          <p>
            Missões, avaliações e preferências ficam reunidas em um só lugar,
            com privacidade e limites de recompensa claramente informados.
          </p>
        </div>
        <aside>
          <span>ANÚNCIOS E PESQUISAS</span>
          <strong>Desativados</strong>
          <small>Nenhum anúncio ou pesquisa paga está ativo.</small>
        </aside>
      </div>

      <nav className="tasks-tabs" aria-label="Seções da Central de Tarefas">
        {[
          ["wall", "Painel de tarefas", "▦"],
          ["mine", "Minhas tarefas", "✓"],
          ["surveys", "Pesquisas", "▤"],
          ["guide", "Como funciona", "?"],
          ["accessibility", "Acessibilidade", "A"],
          ["feedback", "Feedback", "✦"],
        ].map(([id, label, glyph]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            type="button"
            onClick={() => setTab(id as TaskTab)}
          >
            <b>{glyph}</b>
            {label}
          </button>
        ))}
      </nav>

      {tab === "wall" && (
        <>
          <div className="tasks-section-heading">
            <div>
              <span>DISPONÍVEIS AGORA</span>
              <h3>Tarefas internas do Arcadia</h3>
            </div>
            <small>SEM ANÚNCIOS DE TERCEIROS</small>
          </div>
          <div className="task-feature-grid">
            <article>
              <img src={assetsManifest.battery.path} alt="" />
              <div>
                <span>MISSÃO DIÁRIA</span>
                <h4>Tour do Arcade</h4>
                <p>Conclua uma partida em cada um dos três minigames.</p>
                <small>Recompensa: 1 bateria interna · limite diário</small>
              </div>
              <button type="button" onClick={() => onNavigate("games")}>
                JOGAR
              </button>
            </article>
            <article>
              <img src={assetsManifest.cmaCoin.path} alt="" />
              <div>
                <span>EXPERIÊNCIA DO JOGADOR</span>
                <h4>Avalie sua experiência</h4>
                <p>Envie sua nota e ajude a definir as próximas correções.</p>
                <small>Sem prêmio econômico · resposta salva por conta</small>
              </div>
              <button type="button" onClick={() => setTab("feedback")}>
                AVALIAR
              </button>
            </article>
            <article>
              <span className="task-accessibility-glyph" aria-hidden="true">
                Aa
              </span>
              <div>
                <span>ACESSIBILIDADE</span>
                <h4>Avaliação de leitura e controle</h4>
                <p>Confira texto, botões, movimento e montagem dos racks.</p>
                <small>Sem prêmio · perfil técnico mínimo salvo por conta</small>
              </div>
              <button type="button" onClick={() => setTab("accessibility")}>
                AVALIAR ACESSO
              </button>
            </article>
            <article className="locked">
              <span className="task-lock">◇</span>
              <div>
                <span>TAREFAS PARCEIRAS</span>
                <h4>Pesquisas opcionais</h4>
                <p>Área reservada para provedores aprovados e consentimento.</p>
                <small>Nenhum parceiro ou recompensa configurado</small>
              </div>
              <button type="button" disabled>INDISPONÍVEL</button>
            </article>
          </div>

          <div className="task-readiness">
            <div>
              <b>01</b>
              <span>
                <strong>Tarefas internas</strong>
                Ativas e validadas pelo servidor
              </span>
              <em>PRONTO</em>
            </div>
            <div>
              <b>02</b>
              <span>
                <strong>Privacidade e segurança</strong>
                Proteção obrigatória para conteúdo externo
              </span>
              <em>PROTEGIDO</em>
            </div>
            <div>
              <b>03</b>
              <span>
                <strong>Recompensa não monetária</strong>
                Interna, limitada e não transferível
              </span>
              <em>LIMITADO</em>
            </div>
          </div>
        </>
      )}

      {tab === "mine" && (
        <div className="task-personal-board">
          <div className="tasks-section-heading">
            <div>
              <span>SEU CICLO</span>
              <h3>Minhas tarefas</h3>
            </div>
            <small>REINÍCIO DIÁRIO UTC</small>
          </div>
          <div className="task-personal-list">
            <article>
              <b>1</b>
              <div>
                <strong>Jogar Packet Catch</strong>
                <span>Parte 1 de 3 do Tour do Arcade</span>
              </div>
              <button type="button" onClick={() => onNavigate("games")}>
                ABRIR ARCADE
              </button>
            </article>
            <article>
              <b>2</b>
              <div>
                <strong>Revisar a sala e as pools</strong>
                <span>Confira energia, racks e sua distribuição</span>
              </div>
              <button type="button" onClick={() => onNavigate("career")}>
                VER CENTRAL
              </button>
            </article>
            <article>
              <b>3</b>
              <div>
                <strong>Enviar feedback</strong>
                <span>Ajuda o proprietário a priorizar melhorias</span>
              </div>
              <button type="button" onClick={() => setTab("feedback")}>
                RESPONDER
              </button>
            </article>
          </div>
        </div>
      )}

      {tab === "surveys" && (
        <div className="task-survey-readiness">
          <section className="task-empty-state">
            <span>▤</span>
            <h3>Pesquisas externas desativadas</h3>
            <p>
              Nenhum provedor externo recebe dados e nenhuma recompensa
              publicitária é exibida. Nenhum compartilhamento é autorizado
              enquanto esta área estiver desativada.
            </p>
            <ul>
              <li>Escolha voluntária, salva por conta e revogável</li>
              <li>Nova autorização antes de abrir qualquer parceiro</li>
              <li>Recompensa interna, limitada e nunca em CMA, BTC ou DOGE</li>
              <li>Validação do servidor contra repetição e automação</li>
            </ul>
          </section>

          <section className="task-preference-panel">
            <span>SEU CONTROLE</span>
            <h3>Como devemos tratar tarefas parceiras?</h3>
            <p>
              Você pode mudar esta escolha a qualquer momento. O Arcadia
              continuará funcionando normalmente nas duas opções.
            </p>
            {preferenceState === "loading" ? (
              <div className="task-preference-loading">
                Carregando preferência...
              </div>
            ) : (
              <div
                className="task-preference-options"
                role="radiogroup"
                aria-label="Preferência para tarefas parceiras"
              >
                <button
                  className={
                    taskPreference?.partnerTasksMode === "ask" ? "selected" : ""
                  }
                  type="button"
                  role="radio"
                  aria-checked={taskPreference?.partnerTasksMode === "ask"}
                  disabled={preferenceState === "saving"}
                  onClick={() => void savePreference("ask")}
                >
                  <b>PERGUNTAR ANTES</b>
                  <span>
                    Mostrar uma decisão clara antes de liberar qualquer
                    parceiro.
                  </span>
                  <em>RECOMENDADO</em>
                </button>
                <button
                  className={
                    taskPreference?.partnerTasksMode === "disabled"
                      ? "selected"
                      : ""
                  }
                  type="button"
                  role="radio"
                  aria-checked={
                    taskPreference?.partnerTasksMode === "disabled"
                  }
                  disabled={preferenceState === "saving"}
                  onClick={() => void savePreference("disabled")}
                >
                  <b>MANTER DESATIVADO</b>
                  <span>
                    Não oferecer tarefas externas nesta conta, mesmo quando a
                    área for liberada.
                  </span>
                  <em>SEM IMPACTO NO JOGO</em>
                </button>
              </div>
            )}
            <footer>
              <strong>
                {taskPreference?.saved
                  ? "PREFERÊNCIA SALVA NO SERVIDOR"
                  : "NENHUMA ESCOLHA SALVA AINDA"}
              </strong>
              <span>
                Parceiro conectado: <b>NÃO</b>
              </span>
            </footer>
            {preferenceMessage && (
              <p className="task-preference-message" role="status">
                {preferenceMessage}
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "guide" && (
        <div className="task-guide-grid">
          {[
            ["01", "Escolha", "A tarefa informa duração, origem e recompensa antes de começar."],
            ["02", "Autorize", "Conteúdo de parceiros só abre após uma decisão clara do jogador."],
            ["03", "Valide", "O servidor recebe o resultado e verifica limites e duplicidade."],
            ["04", "Credite", "Somente itens internos permitidos entram no inventário."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <b>{number}</b>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      )}

      {tab === "accessibility" && (
        <div className="accessibility-test-layout">
          <form onSubmit={submitAccessibilityReview}>
            <header>
              <span>AVALIAÇÃO DE ACESSIBILIDADE · SEM RECOMPENSA</span>
              <h3>O Arcadia está fácil de ler e controlar?</h3>
              <p>
                Responda com base no aparelho que está usando agora. Isso nos
                ajuda a corrigir problemas de celular, mouse e toque.
              </p>
            </header>

            <div className="accessibility-checklist">
              {([
                [
                  "textReadable",
                  "Os textos e números estão fáceis de ler?",
                  "Observe o menu, os saldos, o poder e as descrições.",
                ],
                [
                  "controlsEasy",
                  "Os botões estão fáceis de localizar e apertar?",
                  "Inclua navegação, loja, pools e telas dos minigames.",
                ],
                [
                  "motionComfortable",
                  "As animações estão confortáveis?",
                  "Considere velocidade, flashes e transições do Arcade.",
                ],
                [
                  "rackClear",
                  "A montagem do rack está clara?",
                  "Verifique seleção, slots livres e encaixe dos mineradores.",
                ],
              ] as Array<[keyof AccessibilityAnswers, string, string]>).map(
                ([key, label, hint], index) => (
                  <fieldset key={key}>
                    <legend>
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      <span>
                        <strong>{label}</strong>
                        <small>{hint}</small>
                      </span>
                    </legend>
                    <div>
                      <button
                        className={
                          accessibilityAnswers[key] === true ? "selected" : ""
                        }
                        type="button"
                        aria-pressed={accessibilityAnswers[key] === true}
                        onClick={() =>
                          setAccessibilityAnswers((current) => ({
                            ...current,
                            [key]: true,
                          }))
                        }
                      >
                        SIM, ESTÁ BOM
                      </button>
                      <button
                        className={
                          accessibilityAnswers[key] === false
                            ? "selected negative"
                            : ""
                        }
                        type="button"
                        aria-pressed={accessibilityAnswers[key] === false}
                        onClick={() =>
                          setAccessibilityAnswers((current) => ({
                            ...current,
                            [key]: false,
                          }))
                        }
                      >
                        NÃO, PRECISA MELHORAR
                      </button>
                    </div>
                  </fieldset>
                ),
              )}
            </div>

            <label className="accessibility-notes">
              O que mais atrapalhou?
              <textarea
                maxLength={500}
                value={accessibilityNotes}
                onChange={(event) => setAccessibilityNotes(event.target.value)}
                placeholder="Opcional: diga em qual tela aconteceu e o que ficou difícil."
              />
              <small>{accessibilityNotes.length}/500 caracteres</small>
            </label>

            <footer>
              <div>
                <strong>
                  {accessibilityReview
                    ? "ÚLTIMA AVALIAÇÃO SALVA"
                    : "AINDA NÃO RESPONDIDO"}
                </strong>
                <small>
                  {accessibilityReview
                    ? new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(accessibilityReview.createdAt))
                    : "As quatro respostas são obrigatórias."}
                </small>
              </div>
              <button
                type="submit"
                disabled={accessibilityState !== "idle"}
              >
                {accessibilityState === "saving"
                  ? "SALVANDO..."
                  : "SALVAR AVALIAÇÃO"}
              </button>
            </footer>
            {accessibilityMessage && (
              <p className="accessibility-response" role="status">
                {accessibilityMessage}
              </p>
            )}
          </form>

          <aside>
            <span>PRIVACIDADE DA AVALIAÇÃO</span>
            <h3>O que é registrado</h3>
            <dl>
              <div>
                <dt>Tela</dt>
                <dd>
                  {deviceProfile?.currentViewport === "small"
                    ? "Pequena"
                    : deviceProfile?.currentViewport === "medium"
                      ? "Média"
                      : "Grande"}
                </dd>
              </div>
              <div>
                <dt>Controle</dt>
                <dd>
                  {deviceProfile?.currentInputMode === "touch"
                    ? "Toque"
                    : deviceProfile?.currentInputMode === "hybrid"
                      ? "Híbrido"
                      : "Mouse/ponteiro"}
                </dd>
              </div>
              <div>
                <dt>Texto</dt>
                <dd>
                  {textScale === "extra"
                    ? "Extragrande"
                    : textScale === "large"
                      ? "Grande"
                      : "Confortável"}
                </dd>
              </div>
            </dl>
            <p>
              Não coletamos IP, modelo do aparelho, impressão digital,
              localização ou rastreador de terceiros. O painel do proprietário
              mostra somente grupos e totais.
            </p>
            <small>
              Esta avaliação não paga CMA, BTC, DOGE, energia ou poder temporário.
            </small>
          </aside>
        </div>
      )}

      {tab === "feedback" && (
        <div className="beta-feedback-layout">
          <form onSubmit={submitFeedback}>
            <span>CANAL DIRETO COM A EQUIPE</span>
            <h3>Conte o que precisa melhorar</h3>
            <label>
              Área
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as BetaFeedbackCategory)
                }
              >
                {betaFeedbackCategories.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Sua nota</legend>
              <div className="feedback-rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    className={rating === value ? "selected" : ""}
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-label={`Nota ${value}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              Comentário
              <textarea
                maxLength={800}
                minLength={10}
                required
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Explique o problema, onde aconteceu e como você esperava que funcionasse."
              />
              <small>Não inclua senhas, documentos ou outros dados pessoais.</small>
            </label>
            <div>
              <small>{message.length}/800 caracteres</small>
              <button
                type="submit"
                disabled={feedbackState === "sending"}
              >
                {feedbackState === "sending" ? "ENVIANDO..." : "ENVIAR FEEDBACK"}
              </button>
            </div>
            {feedbackMessage && (
              <p className="feedback-response" role="status">
                {feedbackMessage}
              </p>
            )}
          </form>

          <aside>
            <div className="tasks-section-heading">
              <div>
                <span>SEUS ENVIOS</span>
                <h3>Histórico recente</h3>
              </div>
            </div>
            {feedbackState === "loading" ? (
              <p>Carregando feedbacks...</p>
            ) : feedback.length === 0 ? (
              <p>Seu primeiro feedback aparecerá aqui.</p>
            ) : (
              <div className="personal-feedback-list">
                {feedback.map((item) => (
                  <article key={item.id}>
                    <div>
                      <span>{categoryLabels[item.category as BetaFeedbackCategory] ?? item.category}</span>
                      <b>{item.rating}/5</b>
                    </div>
                    <p>{item.message}</p>
                    <small>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        month: "short",
                      }).format(new Date(item.createdAt))}{" "}
                      · {feedbackStatusLabels[item.status] ?? "Recebido"}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
