import BotInteraction from '../../types/BotInteraction';
import { Attachment, ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, Channel, MessageFlags } from 'discord.js';

export default class Say extends BotInteraction {
    get name() {
        return 'say';
    }

    get description() {
        return 'Talk as the bot; supports multi-line and converts #channel, @role, and :emoji:';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addAttachmentOption((option) => option.setName('image').setDescription('An optional image attachment.').setRequired(false))
            .addChannelOption((option) => option.setName('channel').setDescription('Channel to speak in').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        const attachment: Attachment | null = interaction.options.getAttachment('image', false);
        const channelOption: Channel | null = interaction.options.getChannel('channel', false);

        const modal = new ModalBuilder()
            .setCustomId('say-command-modal')
            .setTitle('Say something as the bot');

        const messageInput = new TextInputBuilder()
            .setCustomId('say-message-input')
            .setLabel("What do you want to say?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
        modal.addComponents(firstActionRow);
        await interaction.showModal(modal);

        const filter = (i: ModalSubmitInteraction) => i.customId === 'say-command-modal' && i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 300_000 }); // 5 minutes

            const rawMessage: string = modalInteraction.fields.getTextInputValue('say-message-input');
            const parsedMessage = await this.parseMessage(rawMessage, interaction);
            const channel = channelOption ? channelOption : interaction.channel as TextChannel;

            if (channel && 'send' in channel) {
                await channel.send(attachment ? { content: parsedMessage, files: [attachment] } : { content: parsedMessage });
            }

            await modalInteraction.reply({ content: `Message sent!`, flags: MessageFlags.Ephemeral });
        } catch (err) {
            console.error('Say command error:', err);
        }
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async parseMessage(text: string, interaction: ChatInputCommandInteraction): Promise<string> {
        if (!interaction.inCachedGuild()) return text;

        let parsedText = text;

        // Channel Mentions - convert #channel-name to actual mentions
        const channelRegex = /#([\w-]+)/g;
        parsedText = parsedText.replace(channelRegex, (match, channelName) => {
            const channel = interaction.guild.channels.cache.find(c => c.name === channelName);
            return channel ? `${channel}` : match;
        });

        // Role Mentions - convert @role-name to actual mentions
        const roleNames = interaction.guild.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => this.escapeRegex(r.name))
            .sort((a, b) => b.length - a.length); // sort by length to avoid partial matches
        if (roleNames.length > 0) {
            const roleRegex = new RegExp(`(?<!\\w)@(${roleNames.join('|')})(?!\\w)`, 'g');
            parsedText = parsedText.replace(roleRegex, (match, roleName) => {
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                return role ? `${role}` : match;
            });
        }

        // Emoji Mentions - convert :emoji: to actual emojis
        const emojiRegex = /:(\w+):/g;
        parsedText = parsedText.replace(emojiRegex, (match, emojiName) => {
            const emoji = interaction.guild.emojis.cache.find(e => e.name === emojiName);
            return emoji ? `${emoji}` : match;
        });

        return parsedText;
    }
}
