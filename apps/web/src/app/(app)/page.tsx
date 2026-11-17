"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExamConfig,
  OMREngineMode,
  OMREngineSettings,
  OptionLabel,
  QuestionStatus,
  RoundingRule,
  ScoringMode,
} from "@/types/omr";
import { Stepper } from "@/components/ui/stepper";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { AnswerKeyGrid, AnswerKeyItem } from "@/components/answer-key-grid";
import { KeyEditorModal } from "@/components/key-editor-modal";
import {
  getActiveExam,
  saveActiveExam,
  getEngineSettings,
  saveEngineSettings,
  DEFAULT_ENGINE_SETTINGS,
} from "@/lib/db";
import { testServerConnection } from "@/lib/omr-engine/client";
import { toast } from "sonner";
import {
  FileText,
  Camera,
  Cpu,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SetupPage() {
  const router = useRouter();

  // State Identitas Ujian
  const [examTitle, setExamTitle] = React.useState("UTS Matematika - Semester Ganjil");
  const [classNameVal, setClassNameVal] = React.useState("8A");
  const [passingScore, setPassingScore] = React.useState(75);

  // State Struktur Soal (3 kolom: 30 PG, 5 Esai)
  const [pgCount, setPgCount] = React.useState(30);
  const [essayCount, setEssayCount] = React.useState(5);

  // State Pembobotan & Nilai
  const [scoringMode, setScoringMode] = React.useState<ScoringMode>("MODE_A_PERCENTAGE");
  const [weightPg, setWeightPg] = React.useState(60);
  const [weightEssay, setWeightEssay] = React.useState(40);
  const [pointsPerPg, setPointsPerPg] = React.useState(1);
  const [maxScorePerEssay, setMaxScorePerEssay] = React.useState(5);
  const [roundingRule, setRoundingRule] = React.useState<RoundingRule>("ROUND_HALF_UP");

  // State Kunci Jawaban
  const [answers, setAnswers] = React.useState<AnswerKeyItem[]>(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      questionNumber: i + 1,
      key: (["A", "B", "C", "D"] as OptionLabel[])[i % 4],
      status: "ACTIVE" as QuestionStatus,
    }));
  });

  // State Preferensi Engine OMR (Dual-Engine Mode)
  const [engineSettings, setEngineSettings] =
    React.useState<OMREngineSettings>(DEFAULT_ENGINE_SETTINGS);
  const [isTestingConnection, setIsTestingConnection] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<{ ok: boolean; message: string } | null>(
    null
  );

  // Muat konfigurasi tersimpan saat pertama kali halaman dibuka
  React.useEffect(() => {
    async function loadSavedConfig() {
      try {
        const savedEngine = getEngineSettings();
        setEngineSettings(savedEngine);

        const saved = await getActiveExam();
        if (saved) {
          setExamTitle(saved.title || "");
          setClassNameVal(saved.className || "8A");
          setPassingScore(saved.passingScore ?? 75);
          setScoringMode(saved.scoringMode || "MODE_A_PERCENTAGE");
          setRoundingRule(saved.rounding || "ROUND_HALF_UP");
          if (saved.sectionWeights) {
            setWeightPg(saved.sectionWeights.multipleChoicePercent ?? 60);
            setWeightEssay(saved.sectionWeights.essayPercent ?? 40);
          }
          if (saved.multipleChoiceQuestions?.length > 0) {
            const count = Math.min(30, saved.multipleChoiceQuestions.length);
            setPgCount(count);
            setAnswers(
              saved.multipleChoiceQuestions.slice(0, count).map((q) => ({
                questionNumber: q.number,
                key: q.correctAnswer,
                status: q.status,
              }))
            );
            if (saved.multipleChoiceQuestions[0]?.pointsCorrect !== undefined) {
              setPointsPerPg(saved.multipleChoiceQuestions[0].pointsCorrect);
            }
          }
          if (saved.essayQuestions && saved.essayQuestions.length > 0) {
            setEssayCount(saved.essayQuestions.length);
            if (saved.essayQuestions[0]?.maxScore !== undefined) {
              setMaxScorePerEssay(saved.essayQuestions[0].maxScore);
            }
          }
        }
      } catch (err) {
        console.warn("Gagal memuat konfigurasi ujian:", err);
      }
    }
    loadSavedConfig();
  }, []);

  // Ubah jumlah soal PG dan sinkronisasi kunci jawaban secara langsung
  const handlePgCountChange = (val: number) => {
    const count = Math.min(30, Math.max(1, val));
    setPgCount(count);
    setAnswers((prev) => {
      if (prev.length === count) return prev;
      if (prev.length < count) {
        const added = Array.from({ length: count - prev.length }, (_, i) => ({
          questionNumber: prev.length + i + 1,
          key: (["A", "B", "C", "D"] as OptionLabel[])[(prev.length + i) % 4],
          status: "ACTIVE" as QuestionStatus,
        }));
        return [...prev, ...added];
      }
      return prev.slice(0, count);
    });
  };

  // Modal editor kunci per nomor
  const [selectedQuestion, setSelectedQuestion] = React.useState<number | null>(null);

  const activeQuestion = answers.find((a) => a.questionNumber === selectedQuestion);

  const handleSaveKey = (newKey: OptionLabel | null, newStatus: QuestionStatus) => {
    if (selectedQuestion === null) return;
    setAnswers((prev) =>
      prev.map((item) =>
        item.questionNumber === selectedQuestion
          ? { ...item, key: newKey, status: newStatus }
          : item
      )
    );
    toast.success(`Kunci soal #${selectedQuestion} diperbarui.`);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setWeightPg(val);
    setWeightEssay(100 - val);
  };

  const handleEngineModeChange = (mode: OMREngineMode) => {
    const updated = { ...engineSettings, mode };
    setEngineSettings(updated);
    saveEngineSettings(updated);
    setTestStatus(null);
    toast.success(
      mode === "CLIENT_WASM"
        ? "Engine OMR beralih ke In-Browser WASM (Klien / Offline)"
        : "Engine OMR beralih ke Server API (FastAPI / Eksternal)"
    );
  };

  const handleServerUrlChange = (url: string) => {
    const updated = { ...engineSettings, serverUrl: url };
    setEngineSettings(updated);
    saveEngineSettings(updated);
    setTestStatus(null);
  };

  const handleApiKeyChange = (apiKey: string) => {
    const updated = { ...engineSettings, apiKey: apiKey ? apiKey : undefined };
    setEngineSettings(updated);
    saveEngineSettings(updated);
  };

  const handleTestServer = async () => {
    setIsTestingConnection(true);
    setTestStatus(null);
    try {
      const res = await testServerConnection(engineSettings.serverUrl, engineSettings.apiKey);
      if (res.ok) {
        setTestStatus({
          ok: true,
          message: `Terhubung! Service: ${res.engine || "openomr-engine"} (v${res.version || "0.1.0"})`,
        });
        toast.success("Koneksi ke Server OMR Engine berhasil!");
      } else {
        setTestStatus({
          ok: false,
          message: res.error || "Gagal menghubungi server",
        });
        toast.error(`Koneksi server gagal: ${res.error}`);
      }
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveAndScan = async () => {
    if (pgCount > 30) {
      toast.error("Jumlah soal PG melebihi batas lembar A4 standar (maksimum 30 soal PG).");
      return;
    }
    if (pgCount <= 0) {
      toast.error("Jumlah soal PG minimal 1 soal.");
      return;
    }

    const examConfig: ExamConfig = {
      id: "active_exam_config",
      title: examTitle,
      classId: "cls-8a",
      className: classNameVal,
      passingScore,
      scoringMode,
      rounding: roundingRule,
      sectionWeights: {
        multipleChoicePercent: weightPg,
        essayPercent: weightEssay,
      },
      multipleChoiceQuestions: answers.map((a) => ({
        number: a.questionNumber,
        correctAnswer: a.key || "A",
        pointsCorrect: pointsPerPg,
        pointsWrong: 0,
        status: a.status,
      })),
      essayQuestions: Array.from({ length: essayCount }, (_, i) => ({
        number: i + 1,
        maxScore: maxScorePerEssay,
      })),
    };

    try {
      await saveActiveExam(examConfig);
      saveEngineSettings(engineSettings);
      toast.success("Konfigurasi ujian & preferensi engine berhasil disimpan!");
      router.push("/scan");
    } catch (err) {
      console.error("Gagal menyimpan konfigurasi:", err);
      toast.error("Gagal menyimpan konfigurasi ujian.");
    }
  };

  // Kalkulasi total poin maksimal (kecualikan soal status VOID)
  const activePgQuestionsCount = answers.filter((a) => a.status !== "VOID").length;
  const totalMaxPoints =
    scoringMode === "MODE_A_PERCENTAGE"
      ? 100
      : activePgQuestionsCount * pointsPerPg + essayCount * maxScorePerEssay;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Ujian & Aturan
          </h1>
          <p className="text-sm text-slate-500">
            Konfigurasi identitas ujian, KKM, pembobotan, dan kunci jawaban LJK.
          </p>
        </div>
        <Link href="/template">
          <Button variant="secondary" size="sm" className="gap-2">
            <FileText className="w-4 h-4 text-brand-700" />
            <span>Pratinjau LJK A4</span>
          </Button>
        </Link>
      </div>

      {/* 1. Identitas Ujian */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">
            Identitas Ujian
          </span>
          <span className="text-[11px] font-bold text-slate-400">A4 • 3 KOLOM</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="exam-title-input" className="text-xs font-bold text-slate-700">
              Nama / Judul Ujian
            </label>
            <input
              id="exam-title-input"
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Contoh: UTS Matematika - Kelas 8A"
              className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all font-medium text-slate-800"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="class-name-input" className="text-xs font-bold text-slate-700">
              Kelas
            </label>
            <input
              id="class-name-input"
              type="text"
              value={classNameVal}
              onChange={(e) => setClassNameVal(e.target.value)}
              placeholder="8A"
              className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all font-medium text-slate-800"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="passing-score-input" className="text-xs font-bold text-slate-700">
              KKM (Kriteria Ketuntasan Minimal)
            </label>
            <input
              id="passing-score-input"
              type="number"
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value))}
              min={0}
              max={100}
              aria-label="KKM (Kriteria Ketuntasan Minimal)"
              className="w-full h-11 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 transition-all font-bold tabular-nums text-brand-800"
            />
          </div>
        </div>
      </section>

      {/* 2. Struktur Soal Dinamis */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">
            Struktur Soal Dinamis
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Stepper
            label="Pilihan Ganda (A–D)"
            value={pgCount}
            min={1}
            max={30}
            step={1}
            helper="Kapasitas Lembar A4 Standar: maksimum 30 soal PG"
            onChange={handlePgCountChange}
          />
          <Stepper
            label="Soal Esai (Zona Tunggal)"
            value={essayCount}
            min={0}
            max={10}
            step={1}
            helper="Dinilai guru langsung di aplikasi via potongan gambar"
            onChange={setEssayCount}
          />
        </div>
      </section>

      {/* 3. Aturan Pembobotan Nilai */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">
            Aturan Pembobotan Nilai
          </span>
        </div>

        <SegmentedControl
          options={[
            { value: "MODE_A_PERCENTAGE", label: "Mode A: Persentase (0–100)" },
            { value: "MODE_B_DIRECT_POINTS", label: "Mode B: Akumulasi Poin Langsung" },
          ]}
          value={scoringMode}
          onChange={setScoringMode}
        />

        {scoringMode === "MODE_A_PERCENTAGE" ? (
          <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-brand-700">Bobot PG: {weightPg}%</span>
              <span className="text-amber-700">Bobot Esai: {weightEssay}%</span>
            </div>
            <input
              id="weight-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={weightPg}
              aria-label="Bobot Pilihan Ganda (Persen)"
              onChange={handleSliderChange}
              className="w-full accent-brand-700 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>100% Esai</span>
              <span>50 : 50</span>
              <span>100% PG</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1">
              <label htmlFor="points-per-pg-input" className="text-xs font-bold text-slate-600">
                Poin per PG Benar
              </label>
              <input
                id="points-per-pg-input"
                type="number"
                value={pointsPerPg}
                onChange={(e) => setPointsPerPg(Number(e.target.value))}
                min={0.5}
                step={0.5}
                aria-label="Poin per PG Benar"
                className="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 bg-white font-bold tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="max-score-per-essay-input" className="text-xs font-bold text-slate-600">
                Poin Maks per Soal Esai
              </label>
              <input
                id="max-score-per-essay-input"
                type="number"
                value={maxScorePerEssay}
                onChange={(e) => setMaxScorePerEssay(Number(e.target.value))}
                min={1}
                max={50}
                aria-label="Poin Maks per Soal Esai"
                className="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 bg-white font-bold tabular-nums"
              />
            </div>
          </div>
        )}

        {/* Aturan Pembulatan */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-slate-600">Metode Pembulatan Nilai Akhir</label>
          <SegmentedControl
            options={[
              { value: "EXACT_2_DECIMAL", label: "2 Desimal (Eksak)" },
              { value: "ROUND_HALF_UP", label: "Bulat Terdekat (Half-Up)" },
              { value: "CEIL_UP", label: "Bulat ke Atas (Ceil)" },
            ]}
            value={roundingRule}
            onChange={setRoundingRule}
          />
        </div>
      </section>

      {/* 4. Kunci Jawaban PG */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">
            Kunci Jawaban Pilihan Ganda ({pgCount} Soal)
          </span>
          <span className="text-xs text-slate-400">Ketuk chip nomor untuk mengubah</span>
        </div>

        <AnswerKeyGrid
          items={answers}
          selectedNumber={selectedQuestion}
          onSelectQuestion={setSelectedQuestion}
        />

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block" />
            Aktif (Soal Normal)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-brand-700 font-bold">+</span>
            Bonus (Poin Otomatis)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="line-through text-slate-400">Void</span>
            (Dianulir / Dikeluarkan)
          </span>
        </div>
      </section>

      {/* 5. Mode Engine Pemrosesan OMR (Dual-Engine: WASM vs Server API) */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-700" />
            <span className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">
              Mode Engine Pemrosesan OMR
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-400">DUAL-ENGINE ARCHITECTURE</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Pilih engine yang digunakan untuk memproses citra lembar jawaban (LJK). Keduanya menghasilkan format data yang identik.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: In-Browser WASM */}
          <div
            onClick={() => handleEngineModeChange("CLIENT_WASM")}
            className={cn(
              "relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 text-left",
              engineSettings.mode === "CLIENT_WASM"
                ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600/30"
                : "border-slate-200 hover:border-slate-300 bg-white"
            )}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>In-Browser WASM</span>
                </div>
                {engineSettings.mode === "CLIENT_WASM" && (
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-brand-100" />
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                OpenCV.js WebAssembly di Web Worker. Berjalan 100% di browser klien (HP/laptop), tanpa server, dan bekerja secara offline.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md w-fit">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Rekomendasi • Tanpa Setup Server</span>
            </div>
          </div>

          {/* Card 2: Server API */}
          <div
            onClick={() => handleEngineModeChange("SERVER_API")}
            className={cn(
              "relative p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 text-left",
              engineSettings.mode === "SERVER_API"
                ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600/30"
                : "border-slate-200 hover:border-slate-300 bg-white"
            )}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                  <Globe className="w-4 h-4 text-sky-500" />
                  <span>Server API (FastAPI)</span>
                </div>
                {engineSettings.mode === "SERVER_API" && (
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-brand-100" />
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mendelegasikan ke service backend Python (port 8000), integrasi Kelaskita LMS, atau deployment cloud mitra.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md w-fit">
              <span>Endpoint REST /v1/scan/json</span>
            </div>
          </div>
        </div>

        {/* Konfigurasi Server jika SERVER_API aktif */}
        {engineSettings.mode === "SERVER_API" && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  URL Server OMR Engine
                </label>
                <input
                  type="text"
                  value={engineSettings.serverUrl}
                  onChange={(e) => handleServerUrlChange(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="w-full h-10 px-3 text-xs rounded-lg border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  API Key (Opsional)
                </label>
                <input
                  type="password"
                  value={engineSettings.apiKey || ""}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Disertakan via header X-API-Key"
                  className="w-full h-10 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTestServer}
                disabled={isTestingConnection}
                className="text-xs h-8 gap-1.5"
              >
                {isTestingConnection ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-brand-700" />
                )}
                <span>{isTestingConnection ? "Menghubungi Server..." : "Tes Koneksi Server"}</span>
              </Button>

              {testStatus && (
                <span
                  className={cn(
                    "text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium",
                    testStatus.ok
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  )}
                >
                  {testStatus.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  )}
                  <span>{testStatus.message}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 6. Bar CTA Bawah */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-20 lg:bottom-4 z-10">
        <div className="text-xs text-slate-600">
          Total Ujian: <strong className="text-slate-800">{pgCount} PG</strong>
          {essayCount > 0 && <span> + <strong className="text-slate-800">{essayCount} Esai</strong></span>} ·
          Skor Maks: <strong className="text-brand-800">{totalMaxPoints} {scoringMode === "MODE_A_PERCENTAGE" ? "Poin (Normalisasi 100)" : "Poin"}</strong>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={handleSaveAndScan}
          className="w-full sm:w-auto gap-2"
        >
          <Camera className="w-4 h-4 text-white" />
          <span>Simpan Aturan & Mulai Scan LJK</span>
        </Button>
      </div>

      {/* Modal Popup Editor Kunci */}
      {activeQuestion && (
        <KeyEditorModal
          isOpen={selectedQuestion !== null}
          questionNumber={activeQuestion.questionNumber}
          currentKey={activeQuestion.key}
          currentStatus={activeQuestion.status}
          onClose={() => setSelectedQuestion(null)}
          onSave={handleSaveKey}
        />
      )}
    </div>
  );
}
