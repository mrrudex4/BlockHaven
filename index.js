const {
  Client, GatewayIntentBits, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");
const { createTranscript } = require("discord-html-transcripts");
const express = require("express");

const app = express();
app.get("/", (req, res) => {
  res.send("BlockHaven Ticket Bot is alive!");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("HTTP Server running"));

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

client.once("ready", () => {
  console.log("BlockHaven Ticket Bot Online");
});

// Create panel
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

// Handle buttons & forms
client.on("interactionCreate", async (i) => {
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
      const log = i.guild.channels.cache.find(c => c.name === LOG_CHANNEL);
      const transcript = await createTranscript(i.channel);

      if (log) log.send({ content: `📁 Ticket closed by ${i.user.tag}`, files: [transcript] });
      return i.channel.delete();
    }
  }

  if (i.isModalSubmit()) {
    const guild = i.guild;
    const member = i.member;
    const staff = guild.roles.cache.find(r => r.name === STAFF_ROLE);
    const category = guild.channels.cache.find(c => c.name === TICKET_CATEGORY && c.type === 4);

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

    channel.send({
      content: `👤 ${member}\n🧾 IGN: ${i.fields.getTextInputValue("ign")}\n📌 ISSUE:\n${i.fields.getTextInputValue("issue")}\n<@&${staff.id}>`,
      components: [closeBtn]
    });

    i.reply({ content: "✅ Ticket created!", ephemeral: true });

    // Auto-close after 30 minutes
    setTimeout(() => {
      if (channel) channel.delete().catch(() => {});
    }, 1800000);
  }
});

client.login(TOKEN);
