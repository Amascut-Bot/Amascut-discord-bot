import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, TextChannel } from 'discord.js';

export default class PostMessage extends BotInteraction {
    get name() {
        return 'post-message';
    }

    get description() {
        return 'Reposts a Message based on the provided Message-Url';
    }

    get permissions() {
        return 'EDITOR';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('messagelink').setDescription('Link of the Message').setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        //https://discord.com/channels/885457551397912596/1393584215748116540/1400172682858729582
        //message url: guild/channel/message

        const messageLink: string = interaction.options.getString('messagelink', true);

        const match = messageLink.match(/^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/);

        if (match) {
            const guildId = match[1];
            const channelId = match[2];
            const messageId = match[3];

            const guild = await interaction.client.guilds.fetch(guildId);

            if (guild) {
                const channel = await guild.channels.fetch(channelId) as TextChannel;

                if (channel) {
                    const message = await channel.messages.fetch(messageId);

                    if (message) {
                        await (interaction.channel as TextChannel).send({
                            content: message.content,
                            embeds: message.embeds,
                            components: message.components,
                            flags: message.flags.has(MessageFlags.IsComponentsV2) ? MessageFlags.IsComponentsV2 : undefined,
                            allowedMentions: { "parse" : [] }
                        });
                    } else {
                        return await interaction.editReply('[Unknown Message] - The linked Message seems to no longer exist.');
                    }
                } else {
                    return await interaction.editReply('[Unknown Channel] - The Bot seems to not have permissions to view that channel.');
                }
            } else {
                return await interaction.editReply('[Unknown Guild] - The Bot seems to not be part of the guild, that message originates from.')
            }
        } else {
            return await interaction.editReply('[Invalid URL] - Invalid Message-Link provided!');
        }

        await interaction.editReply(`Successfully posted Message`);
    }
}
