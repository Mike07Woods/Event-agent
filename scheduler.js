// scheduler.js — Entry point and pipeline orchestrator.
// Sets up the weekly cron job (Monday 08:00 Cairo time) and exposes
// a run_pipeline() function that can also be triggered manually.

import cron       from "node-cron";
import fs         from "fs/promises";
import config     from "./config.js";
import { scrape_events }  from "./scraper.js";
import { analyze_events } from "./analyzer.js";
import { rank_events }    from "./ranker.js";
import { build_report }   from "./reporter.js";
import { send_whatsapp }  from "./notifier.js";

// ─── Full pipeline: scrape → analyze → rank → report → notify → write ────────
export async function run_pipeline() {
  const start_time = Date.now();
  console.log("═══════════════════════════════════════════════════");
  console.log(`🚀 Event Radar pipeline started at ${new Date().toLocaleString("en-EG", { timeZone: "Africa/Cairo" })} (Cairo)`);
  console.log("═══════════════════════════════════════════════════");

  try {
    // 1. Scrape — search the web for raw event results
    const raw_events = await scrape_events();

    if (raw_events.length === 0) {
      console.warn("⚠️  No events scraped. Check your SERPER_API_KEY and network connection.");
    }

    // 2. Analyze — score and annotate each event
    const analyzed = analyze_events(raw_events);

    // 3. Rank — sort, deduplicate, and bucket by priority
    const ranked = rank_events(analyzed);

    // 4. Report — build the digest text and summary object
    const report = build_report(ranked);

    // 5. Write events.json — the dashboard reads this file to render cards
    const output = {
      summary: report.summary,
      events:  report.events,
    };
    await fs.writeFile(
      config.output.eventsFile,
      JSON.stringify(output, null, 2),
      "utf-8"
    );
    console.log(`\n💾 Wrote ${report.events.length} events to ${config.output.eventsFile}`);

    // 6. Notify — send the WhatsApp digest
    const notify_result = await send_whatsapp(report.whatsapp_message);

    const elapsed = ((Date.now() - start_time) / 1000).toFixed(1);
    console.log("\n═══════════════════════════════════════════════════");
    console.log(`✅ Pipeline complete in ${elapsed}s`);
    console.log(`   Events: ${ranked.total} | High: ${ranked.high.length} | Medium: ${ranked.medium.length} | Low: ${ranked.low.length}`);
    console.log(`   Notification: ${notify_result.success ? "sent ✅" : "failed ❌"}`);
    console.log("═══════════════════════════════════════════════════\n");

    return report;
  } catch (err) {
    console.error("\n❌ Pipeline error:", err.message);
    console.error(err.stack);
    throw err;
  }
}

// ─── Determine run mode from CLI args ────────────────────────────────────────
const args = process.argv.slice(2);
const run_now = args.includes("--now") || args.includes("-n");

if (run_now) {
  // Manual run: node scheduler.js --now
  console.log("🔧 Manual run triggered via --now flag\n");
  run_pipeline().catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
  });
} else {
  // Scheduled run: start the cron daemon
  console.log(`⏰ Event Radar scheduler started.`);
  console.log(`   Schedule : Every Monday at 08:00 Cairo time`);
  console.log(`   Cron     : ${config.scheduler.cronExpression}`);
  console.log(`   Timezone : ${config.scheduler.timezone}`);
  console.log(`\n   Tip: run  node scheduler.js --now  to trigger immediately.\n`);

  cron.schedule(
    config.scheduler.cronExpression,
    () => {
      console.log("\n⏰ Cron triggered. Starting pipeline...");
      run_pipeline().catch((err) =>
        console.error("Pipeline failed in scheduled run:", err.message)
      );
    },
    { timezone: config.scheduler.timezone }
  );
}
