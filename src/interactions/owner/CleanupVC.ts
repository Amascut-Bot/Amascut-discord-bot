
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, ChannelType, VoiceChannel } from 'discord.js';
import Bot from '../../Bot';
import BotInteraction from '../../types/BotInteraction';
import { getChannels } from '../../GuildSpecifics';

export default class CleanupVC extends BotInteraction {
    get name() {
        return 'cleanup-vc';
    }

    get description() {
        return 'Deletes all empty temporary voice channels.';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
    }

    constructor(client: Bot) {
        super(client);
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const channels = getChannels(interaction.guild.id);
        const tempVCCategories = [channels.tempVCCategory, channels.tempVCCategory2].filter(Boolean);
        const excludedChannels = ['1389392880518566138', '1389391295130374237'];

        let deletedCount = 0;

        for (const categoryId of tempVCCategories) {
            const category = await interaction.guild.channels.fetch(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
                continue;
            }

            for (const channel of category.children.cache.values()) {
                if (channel.type === ChannelType.GuildVoice && !excludedChannels.includes(channel.id)) {
                    const voiceChannel = channel as VoiceChannel;
                    if (voiceChannel.members.size === 0) {
                        try {
                            await voiceChannel.delete('Manual temporary VC cleanup.');
                            deletedCount++;
                        } catch (error) {
                            this.client.logger.error({
                                handler: this.constructor.name,
                                message: `Failed to delete channel ${channel.name} (${channel.id})`,
                                error: error as Error,
                            });
                        }
                    }
                }
            }
        }

        await interaction.editReply(`Cleanup complete. Deleted ${deletedCount} empty voice channel(s).`);
    }
}
