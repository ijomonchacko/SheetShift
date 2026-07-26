import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Generate the sample chart IN THE BROWSER with pdf-lib — no network
 * request, no static file, nothing to download. The bytes go straight
 * into the dropzone as if the user had picked a file.
 */
export async function generateDemoChart() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const maroon = rgb(0.667, 0, 0);
  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.4, 0.4, 0.4);

  page.drawText("Demo Chart — Golden Hour", { x: 60, y: 740, size: 22, font: helvB, color: black });
  page.drawText("Key of C · SheetShift sample", { x: 60, y: 715, size: 11, font: helv, color: gray });

  const lines = [
    { chords: [["C", 60], ["Am", 180], ["F", 300], ["G", 420]], lyric: "Walking down the avenue as evening settles in" },
    { chords: [["C", 60], ["Am", 180], ["Fsus2", 300], ["G7", 430]], lyric: "Every window catches light and throws it back again" },
    { chords: [["Dm7", 60], ["G", 200], ["C/E", 330], ["Am", 460]], lyric: "And I could stay forever in this golden hour glow" },
    { chords: [["F", 60], ["G", 200], ["C", 340]], lyric: "Where everything we planted finally starts to grow" },
  ];
  let y = 660;
  for (const ln of lines) {
    for (const [c, x] of ln.chords) page.drawText(c, { x, y, size: 13, font: helvB, color: maroon });
    page.drawText(ln.lyric, { x: 60, y: y - 20, size: 12, font: helv, color: black });
    y -= 60;
  }

  page.drawText("Bridge", { x: 60, y: y - 4, size: 11, font: helvB, color: gray });
  y -= 28;
  for (const [c, x] of [["Am", 60], ["F", 170], ["C", 280], ["G", 390]]) {
    page.drawText(c, { x, y, size: 13, font: helvB, color: maroon });
  }
  page.drawText("Hold on to the feeling, let the moment slow", { x: 60, y: y - 20, size: 12, font: helv, color: black });

  const bytes = await doc.save();
  return new File([bytes], "demo-chart.pdf", { type: "application/pdf" });
}
