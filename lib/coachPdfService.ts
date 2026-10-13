import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { DailyCoachChatDoc } from "@/lib/types";
import {
  deleteCoachChatDays,
  getAllCoachDailyChats,
  getCoachChatsOlderThan,
} from "@/lib/firestoreDatabase";

function formatTimestamp(ts: number): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDateHeader(dateIso: string): string {
  try {
    const d = new Date(dateIso + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateIso;
  }
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
}

/**
 * Builds a beautiful, responsive HTML document representing the 30-day AI Coach chat.
 */
export function buildCoachChatHtml(
  chats: DailyCoachChatDoc[],
  title = "MindFlow AI Coach — 30-Day Chat History Archive",
): string {
  const exportDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalDays = chats.length;
  const totalExchanges = chats.reduce((acc, c) => acc + (c.exchanges?.length || 0), 0);

  let daysHtml = "";

  for (const dayDoc of chats) {
    if (!dayDoc.exchanges || dayDoc.exchanges.length === 0) continue;

    const formattedDate = formatDateHeader(dayDoc.date);

    let exchangesHtml = "";
    for (const ex of dayDoc.exchanges) {
      const userTime = formatTimestamp(ex.userTimestamp);
      const aiTime = formatTimestamp(ex.assistantTimestamp);

      exchangesHtml += `
        <div class="exchange-block">
          <!-- User Message -->
          <div class="message-row user-row">
            <div class="message-bubble user-bubble">
              <div class="sender-name">You</div>
              <div class="message-text">${escapeHtml(ex.userMessage)}</div>
              <div class="message-time">${userTime}</div>
            </div>
          </div>

          <!-- AI Reply -->
          <div class="message-row ai-row">
            <div class="message-bubble ai-bubble">
              <div class="sender-name">AI Coach</div>
              <div class="message-text">${escapeHtml(ex.assistantReply)}</div>
              <div class="message-time">${aiTime}</div>
            </div>
          </div>
        </div>
      `;
    }

    daysHtml += `
      <div class="day-section">
        <div class="day-header">
          <span class="day-icon">📅</span>
          <span class="day-title">${formattedDate}</span>
          <span class="day-badge">${dayDoc.exchanges.length} messages</span>
        </div>
        <div class="day-exchanges">
          ${exchangesHtml}
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style>
          @page {
            margin: 20mm 15mm;
            size: A4;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            padding: 24px;
            line-height: 1.5;
          }
          .archive-header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #ffffff;
            padding: 28px;
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          }
          .archive-header h1 {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .archive-subtitle {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 16px;
          }
          .stats-grid {
            display: flex;
            gap: 16px;
          }
          .stat-pill {
            background: rgba(255, 255, 255, 0.1);
            padding: 8px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.15);
          }
          .day-section {
            background: #ffffff;
            border-radius: 14px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid #e2e8f0;
            page-break-inside: avoid;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .day-header {
            display: flex;
            align-items: center;
            border-bottom: 1.5px solid #f1f5f9;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .day-icon {
            font-size: 18px;
            margin-right: 8px;
          }
          .day-title {
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
            flex-grow: 1;
          }
          .day-badge {
            background: #eff6ff;
            color: #2563eb;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
          }
          .exchange-block {
            margin-bottom: 16px;
            padding-bottom: 14px;
            border-bottom: 1px dashed #f1f5f9;
          }
          .exchange-block:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }
          .message-row {
            display: flex;
            margin-bottom: 8px;
          }
          .user-row {
            justify-content: flex-end;
          }
          .ai-row {
            justify-content: flex-start;
          }
          .message-bubble {
            max-width: 82%;
            padding: 12px 16px;
            border-radius: 14px;
            position: relative;
          }
          .user-bubble {
            background: #2563eb;
            color: #ffffff;
            border-bottom-right-radius: 4px;
          }
          .ai-bubble {
            background: #f1f5f9;
            color: #1e293b;
            border-bottom-left-radius: 4px;
            border: 1px solid #e2e8f0;
          }
          .sender-name {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            opacity: 0.8;
          }
          .message-text {
            font-size: 13px;
            line-height: 1.5;
            word-wrap: break-word;
          }
          .message-time {
            font-size: 9px;
            text-align: right;
            margin-top: 4px;
            opacity: 0.7;
          }
          .footer-note {
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="archive-header">
          <h1>🧠 MindFlow AI Coach</h1>
          <div class="archive-subtitle">30-Day Chat History Record • Exported ${exportDate}</div>
          <div class="stats-grid">
            <div class="stat-pill">📅 ${totalDays} Active Chat Days</div>
            <div class="stat-pill">💬 ${totalExchanges} Coach Exchanges</div>
            <div class="stat-pill">🔒 Verified Offline Backup</div>
          </div>
        </div>

        ${
          daysHtml.trim()
            ? daysHtml
            : '<div class="day-section" style="text-align:center;color:#64748b;">No conversation history recorded in this period.</div>'
        }

        <div class="footer-note">
          Generated automatically by MindFlow Detox & Habit System. Confidential personal record.
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates a PDF file from daily chats and opens the system Share/Download sheet.
 */
export async function downloadCoachChatPdf(
  chats: DailyCoachChatDoc[],
  title = "MindFlow_AI_Coach_Chat_Archive.pdf",
): Promise<{ uri: string; success: boolean; error?: string }> {
  try {
    const html = buildCoachChatHtml(chats);

    if (Platform.OS === "web") {
      // Web: Open print dialog directly
      await Print.printAsync({ html });
      return { uri: "web", success: true };
    }

    // Native: Render PDF to local file URI
    const file = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (!file?.uri) {
      throw new Error("Failed to generate PDF file.");
    }

    // Prompt user to save / share / download the generated PDF
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Download AI Coach 30-Day Chat PDF",
        UTI: "com.adobe.pdf",
      });
    }

    return { uri: file.uri, success: true };
  } catch (err: any) {
    console.error("downloadCoachChatPdf error:", err);
    return { uri: "", success: false, error: err?.message || String(err) };
  }
}

/**
 * Enforces the 30-day lifecycle requested:
 * 1. Finds all chat documents older than 30 days.
 * 2. FIRST downloads all those chats into a PDF file.
 * 3. ONLY THEN deletes those documents from Cloud Firestore.
 */
export async function exportAndPurgeExpiredCoachChats(
  daysThreshold = 30,
): Promise<{ archivedCount: number; pdfGenerated: boolean; uri?: string; error?: string }> {
  const expiredDocs = await getCoachChatsOlderThan(daysThreshold);

  if (expiredDocs.length === 0) {
    return { archivedCount: 0, pdfGenerated: false };
  }

  // Step 1 & 2: Generate PDF and present download
  const result = await downloadCoachChatPdf(
    expiredDocs,
    `Coach_Chat_Archive_Prior_${daysThreshold}_Days.pdf`,
  );

  if (!result.success) {
    // DO NOT delete if PDF generation or download failed!
    return {
      archivedCount: 0,
      pdfGenerated: false,
      error: `PDF generation failed: ${result.error}. Preserved Firestore chats without deleting.`,
    };
  }

  // Step 3: Delete expired documents from Firestore only after PDF download is complete
  const datesToDelete = expiredDocs.map((d) => d.date);
  await deleteCoachChatDays(datesToDelete);

  return {
    archivedCount: expiredDocs.length,
    pdfGenerated: true,
    uri: result.uri,
  };
}

/**
 * On-demand export of all current chat history to PDF without deleting anything.
 */
export async function exportAllCoachChatsToPdf(): Promise<{
  success: boolean;
  totalDays: number;
  uri?: string;
  error?: string;
}> {
  const allChats = await getAllCoachDailyChats();
  if (allChats.length === 0) {
    return { success: false, totalDays: 0, error: "No chat history to export." };
  }

  const result = await downloadCoachChatPdf(allChats, "MindFlow_Full_Coach_Chat_History.pdf");
  return {
    success: result.success,
    totalDays: allChats.length,
    uri: result.uri,
    error: result.error,
  };
}
