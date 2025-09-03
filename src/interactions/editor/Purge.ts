import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, ChannelType, Message, MessageFlags, GuildMember, Collection, FetchMessagesOptions } from 'discord.js';

export default class Purge extends BotInteraction {
    get name() {
        return 'purge';
    }

    get description() {
        return 'Purges a channel, keeps pinned messages';
    }

    get permissions() {
        return 'EDITOR';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addChannelOption((option) =>
                option
                    .setName('channel')
                    .setDescription('Which channel to send the message to')
                    .setRequired(false)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread)
            );
    }

    async run(interaction: ChatInputCommandInteraction<'cached'>) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const member: GuildMember = await interaction.member.fetch(true);
        const memberEditorRole = member.roles.cache.get(this.client.roleIds?.editor);
        const isAdmin = member.roles.cache.some(role => role.id === this.client.roleIds.owner || role.id === this.client.roleIds.admin);
        const stagingCategory: string = this.client.channelIds.stagingEditorHub!;
        const targetChannel = (interaction.options.getChannel('channel', false) || interaction.channel) as TextChannel;

        // check if the channel has a parent, if not then crash :)
        const parentCategory: string | null = targetChannel.parentId;
        if (!parentCategory) {
            return await interaction.editReply({ content: 'The channel you selected has no parent category.' })
        }

        if (!targetChannel || !('send' in targetChannel)) {
            return await interaction.editReply({
                content: 'Invalid channel selected. Please choose a text channel.'
            });
        }

        if (!isAdmin && parentCategory !== stagingCategory && memberEditorRole) {
            return await interaction.editReply({ content: 'You do not have permissions to purge this channel here.' })
        }

        let messages = new Collection<string, Message<true>>();
        let lastId: string | undefined;

        while (true) {
            const options: FetchMessagesOptions = { limit: 100 };
            if (lastId) options.before = lastId;

            const fetched = await targetChannel.messages.fetch(options);
            if (fetched.size === 0) break;


            messages = messages.concat(fetched);
            lastId = fetched.last()?.id;
        }

        const messageArray = Array.from(messages.values()).reverse();

        for (const message of messageArray) {
            if (!message.pinned) {
                await message.delete().catch(() => {});
            }
        }

        return await interaction.editReply(`Deleted ~ ${messageArray.length} messages.`);
    }
}
