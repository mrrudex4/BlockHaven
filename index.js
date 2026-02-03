const {
  Client, GatewayIntentBits, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");
const { createTranscript } = require("discord-html-transcripts");
const express = require("express");

// ─── Express keepalive (prevents Render from spinning down) ───
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("BlockHaven Ticket Bot is alive!");
});

app.listen(PORT, () => console.log(`[HTTP] Server running on port ${PORT}`));

// ─── Self-ping every 25 min so Render doesn't sleep the instance ───
setInterval(() => {
  require("http").get(`http://localhost:${PORT}`, (res) => {
    console.log(`[PING] Self-ping status: ${res.statusCode}`);
  }).on("error", (e) => console.error("[PING] Self-ping failed:", e.message));
}, 25 * 60 * 1000); // 25 minutes

// ─── Discord Client ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const STAFF_ROLE = "Support";
const TICKET_CATEGORY = "TICKETS";
const LOG_CHANNEL = "ticket-logs";

// ─── Crash safety net ───
process.on("uncaughtException", (err) => {
  console.error("[CRASH] Uncaught Exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[CRASH] Unhandled Rejection:", err);
});

// ─── Token check before login ───
if (!TOKEN) {
  console.error("[ERROR] TOKEN environment variable is missing or empty!");
  console.error("        Go to Render → your service → Environment → add TOKEN");
  process.exit(1);
}

client.once("ready", () => {
  console.log(`[BOT] BlockHaven Ticket Bot online as ${client.user.tag}`);
});

// ─── Login with error handling ───
client.login(TOKEN).catch((err) => {
  console.error("[LOGIN] Failed to log in:", err.message);
  console.error("        Double-check your TOKEN value in Render Environment variables.");
  console.error("        Make sure there are no extra spaces or quotes around it.");
});

// ─── Create panel ───
client.on("messageCreate", async (msg) => {
  if (msg.content === "!panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 BLOCKHAVEN SUPPORT")
      .setDescription("CLICK BELOW TO OPEN A TICKET")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket")
        .setLabel("🎫 OPEN TICKET")
        .setStyle(ButtonStyle.Success)
    );

    msg.channel.send({ embeds: [embed], components: [row] });
  }
});

// ─── Handle buttons & modals ───
client.on("interactionCreate", async (i) => {
  try {
    // ── Button interactions ──
    if (i.isButton()) {
      if (i.customId === "open_ticket") {
        const modal = new ModalBuilder()
          .setCustomId("ticket_modal")
          .setTitle("BLOCKHAVEN TICKET");

        const ign = new TextInputBuilder()
          .setCustomId("ign")
          .setLabel("YOUR MINECRAFT IGN")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const issue = new TextInputBuilder()
          .setCustomId("issue")
          .setLabel("DESCRIBE YOUR ISSUE")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(ign),
          new ActionRowBuilder().addComponents(issue)
        );

        return i.showModal(modal);
      }

      if (i.customId === "close_ticket") {
        await i.deferReply({ ephemeral: true });

        const log = i.guild.channels.cache.find(c => c.name === LOG_CHANNEL);
        const transcript = await createTranscript(i.channel);

        if (log) {
          await log.send({ content: `📁 Ticket closed by ${i.user.tag}`, files: [transcript] });
        }

        await i.editReply({ content: "🔒 Ticket closed." });
        return i.channel.delete();
      }
    }

    // ── Modal submit ──
    if (i.isModalSubmit()) {
      const guild = i.guild;
      const member = i.member;

      const staff = guild.roles.cache.find(r => r.name === STAFF_ROLE);
      if (!staff) {
        console.error(`[TICKET] Role "${STAFF_ROLE}" not found in guild.`);
        return i.reply({ content: "⚠️ Setup error: Staff role not found. Contact admin.", ephemeral: true });
      }

      const category = guild.channels.cache.find(c => c.name === TICKET_CATEGORY && c.type === 4);
      if (!category) {
        console.error(`[TICKET] Category "${TICKET_CATEGORY}" not found in guild.`);
        return i.reply({ content: "⚠️ Setup error: Ticket category not found. Contact admin.", ephemeral: true });
      }

      const channel = await guild.channels.create({
        name: `ticket-${member.user.username}`,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: staff.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      const closeBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 CLOSE")
          .setStyle(ButtonStyle.Danger)
      );

      const ign = i.fields.getTextInputValue("ign");
      const issue = i.fields.getTextInputValue("issue");

      channel.send({
        content: `👤 ${member}\n🧾 IGN: ${ign}\n📌 ISSUE:\n${issue}\n<@&${staff.id}>`,
        components: [closeBtn]
      });

      i.reply({ content: "✅ Ticket created!", ephemeral: true });

      // Auto-close after 30 minutes
      setTimeout(async () => {
        try {
          if (channel && !channel.deleted) {
            const log = guild.channels.cache.find(c => c.name === LOG_CHANNEL);
            const transcript = await createTranscript(channel);
            if (log) await log.send({ content: `📁 Ticket auto-closed (30 min timeout)`, files: [transcript] });
            await channel.delete();
          }
        } catch (e) {
          console.error("[AUTO-CLOSE] Failed:", e.message);
        }
      }, 1800000);
    }
  } catch (err) {
    console.error("[INTERACTION] Error:", err);
  }
});
