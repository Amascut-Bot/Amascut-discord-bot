import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';

export default class AttachTicketButtons extends BotInteraction {
    get name() {
        return 'attach-ticket-buttons';
    }

    get description() {
        return 'Attach ticket system buttons to an existing message';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('message_id')
                    .setDescription('The ID of the message to attach buttons to')
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel containing the message (optional - defaults to current channel)')
                    .setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        const messageId = interaction.options.getString('message_id', true);
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            const ticketButtons = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_suggestion')
                        .setLabel('Suggestion')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('ticket_report')
                        .setLabel('Report')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('ticket_contentcreator')
                        .setLabel('Content Creator')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('ticket_other')
                        .setLabel('Other')
                        .setStyle(ButtonStyle.Secondary)
                );

            if (!targetChannel?.isTextBased()) {
                await interaction.reply({ 
                    content: 'Please specify a text channel.', 
                    ephemeral: true 
                });
                return;
            }

            let message;
            try {
                message = await targetChannel.messages.fetch(messageId);
            } catch (fetchError) {
                await interaction.reply({ 
                    content: `Could not find a message with ID \`${messageId}\` in ${targetChannel}. Please check:\n• The message ID is correct\n• The message exists in the specified channel\n• I have permission to view that channel`, 
                    ephemeral: true 
                });
                return;
            }

            if (message.author.id !== this.client.user?.id) {
                const botMember = interaction.guild.members.cache.get(this.client.user?.id || '');
                if (!botMember?.permissions.has('ManageMessages')) {
                    await interaction.reply({ 
                        content: 'I can only attach buttons to my own messages, or I need the "Manage Messages" permission to edit other messages.', 
                        ephemeral: true 
                    });
                    return;
                }
            }

            if (message.components.length >= 5) {
                await interaction.reply({ 
                    content: 'This message already has the maximum number of button rows (5). Please remove some buttons first.', 
                    ephemeral: true 
                });
                return;
            }

            // Edit the message to add buttons
            await message.edit({
                content: message.content,
                embeds: message.embeds,
                components: [...message.components, ticketButtons]
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('Ticket Buttons Attached')
                .setDescription(`Successfully attached ticket buttons to [message](${message.url})`)
                .setColor(0x00ff00);

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            this.client.logger.error({
                handler: this.constructor.name,
                message: `Failed to attach ticket buttons to message ${messageId}`,
                error: error
            });

            let errorMessage = 'Failed to attach ticket buttons. ';
            
            if (error instanceof Error) {
                if (error.message.includes('Missing Permissions')) {
                    errorMessage += 'I don\'t have permission to edit this message.';
                } else if (error.message.includes('Unknown Message')) {
                    errorMessage += 'The message was not found.';
                } else {
                    errorMessage += 'Please check the message ID and try again.';
                }
            } else {
                errorMessage += 'Please check the message ID and try again.';
            }

            await interaction.reply({ 
                content: errorMessage, 
                ephemeral: true 
            });
        }
    }
} 