const { Client, GatewayIntentBits, PermissionsBitField,
ActionRowBuilder, ButtonBuilder, ButtonStyle,
EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { createTranscript } = require("discord-html-transcripts");

const client = new Client({ intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});

const TOKEN = process.env.TOKEN;
const STAFF_ROLE = "Support";
const TICKET_CATEGORY = "TICKETS";
const LOG_CHANNEL = "ticket-logs";

client.once("ready",()=>console.log("Ticket Bot Online"));

client.on("messageCreate", async m=>{
 if(m.content==="!panel"){
  const e=new EmbedBuilder().setTitle("🎫 BLOCKHAVEN SUPPORT").setDescription("CLICK A BUTTON").setColor("Blue");
  const r=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId("open").setLabel("🎫 OPEN TICKET").setStyle(ButtonStyle.Success)
  );
  m.channel.send({embeds:[e],components:[r]});
 }
});

client.on("interactionCreate", async i=>{
 if(i.isButton()){
  const modal=new ModalBuilder().setCustomId("modal").setTitle("OPEN TICKET");
  const ign=new TextInputBuilder().setCustomId("ign").setLabel("YOUR MC IGN").setStyle(TextInputStyle.Short).setRequired(true);
  const issue=new TextInputBuilder().setCustomId("issue").setLabel("YOUR ISSUE").setStyle(TextInputStyle.Paragraph).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(ign),new ActionRowBuilder().addComponents(issue));
  return i.showModal(modal);
 }

 if(i.isModalSubmit()){
  const g=i.guild,m=i.member;
  const staff=g.roles.cache.find(r=>r.name===STAFF_ROLE);
  const cat=g.channels.cache.find(c=>c.name===TICKET_CATEGORY && c.type===4);

  const ch=await g.channels.create({
   name:`ticket-${m.user.username}`,
   parent:cat.id,
   permissionOverwrites:[
    {id:g.id,deny:[PermissionsBitField.Flags.ViewChannel]},
    {id:m.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]},
    {id:staff.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]}
   ]
  });

  const close=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("close").setLabel("🔒 CLOSE").setStyle(ButtonStyle.Danger));
  ch.send({content:`👤 ${m}\nIGN: ${i.fields.getTextInputValue("ign")}\nISSUE: ${i.fields.getTextInputValue("issue")}\n<@&${staff.id}>`,components:[close]});
  i.reply({content:"Ticket created!",ephemeral:true});
 }

 if(i.customId==="close"){
  const log=i.guild.channels.cache.find(c=>c.name===LOG_CHANNEL);
  const file=await createTranscript(i.channel);
  log.send({files:[file]});
  i.channel.delete();
 }
});

client.login(TOKEN);
