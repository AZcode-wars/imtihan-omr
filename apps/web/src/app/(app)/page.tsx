"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExamConfig, OptionLabel, QuestionStatus, RoundingRule, ScoringMode } from "@/types/omr";
import { Stepper } from "@/components/ui/stepper";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { AnswerKeyGrid, AnswerKeyItem } from "@/components/answer-key-grid";
import { KeyEditorModal } from "@/components/key-editor-modal";
import { getActiveExam, saveActiveExam } from "@/lib/db";
import { toast } from "sonner";
import { FileText, Camera } from "lucide-react";

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

  // Muat konfigurasi tersimpan saat pertama kali halaman dibuka
  React.useEffect(() => {
    async function loadSavedConfig() {
      try {
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
            setPgCount(saved.multipleChoiceQuestions.length);
            setAnswers(
              saved.multipleChoiceQuestions.map((q) => ({
                questionNumber: q.number,
                key: q.correctAnswer,
                status: q.status,
              }))
            );
          }
          if (saved.essayQuestions) {
            setEssayCount(saved.essayQuestions.length);
          }
        }
      } catch (err) {
        console.warn("Gagal memuat konfigurasi ujian:", err);
      }
    }
    loadSavedConfig();
  }, []);

  // Sinkronisasi jumlah kunci saat pgCount berubah
  React.useEffect(() => {
    setAnswers((prev) => {
      if (prev.length === pgCount) return prev;
      if (prev.length < pgCount) {
        const added = Array.from({ length: pgCount - prev.length }, (_, i) => ({
          questionNumber: prev.length + i + 1,
          key: (["A", "B", "C", "D"] as OptionLabel[])[(prev.length + i) % 4],
          status: "ACTIVE" as QuestionStatus,
        }));
        return [...prev, ...added];
      }
      return prev.slice(0, pgCount);
    });
  }, [pgCount]);

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

  const handleSaveAndScan = async () => {
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
      toast.success("Konfigurasi ujian berhasil disimpan ke sesi lokal!");
      router.push("/scan");
    } catch (err) {
      console.error("Gagal menyimpan konfigurasi:", err);
      toast.error("Gagal menyimpan konfigurasi ujian.");
    }
  };

  // Kalkulasi total poin maksimal
  const totalMaxPoints =
    scoringMode === "MODE_A_PERCENTAGE"
      ? 100
      : pgCount * pointsPerPg + essayCount * maxScorePerEssay;

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
            max={63}
            step={1}
            helper="Kapasitas A4: maks 63 soal (tanpa esai) / 45 soal (dengan esai)"
            onChange={setPgCount}
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

      {/* 5. Bar CTA Bawah */}
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
