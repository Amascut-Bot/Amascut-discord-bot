import { Timeout } from '../../entity/Timeout';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, User, GuildMember } from 'discord.js';


export default class TimeoutCommand extends BotInteraction {
    get name() {
        return 'timeout';
    }

    get description() {
        return 'Manage user timeouts';
    }

    get permissions() {
        return 'ADMIN';
    }

    get actionOptions() {
        const actions = ['add', 'remove'];
        const options: { name: string; value: number }[] = [];
        actions.forEach((action, index) => {
            options.push({
                name: action,
                value: index
            });
        });
        return options;
    }

    get typeOptions() {
        const types = ['global', 'teamforming'];
        const options: { name: string; value: number }[] = [];
        types.forEach((action, index) => {
            options.push({
                name: action,
                value: index
            })
        });
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addNumberOption((option) => option.setName('action').setDescription('Action to perform').addChoices([...this.actionOptions]).setRequired(true))
            .addUserOption((option) => option.setName('user').setDescription('User to timeout').setRequired(true))
            .addStringOption((option) => option.setName('duration').setDescription('Timeout duration (e.g. 10m, 1h, 1d) - required for add action').setRequired(false))
            .addStringOption((option) => option.setName('reason').setDescription('Reason for timeout').setRequired(false))
            .addNumberOption((option) => option.setName('type').setDescription('Type of timeout').addChoices([...this.typeOptions]).setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const adminChannelId = this.client.channelIds.ADMIN_CHANNEL;

        if (interaction.channel?.id === adminChannelId) {
            await interaction.deferReply();
        } else {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const action: number = interaction.options.getNumber('action', true);
        const type: number = interaction.options.getNumber('type', false) ?? 0;
        const user: User = interaction.options.getUser('user', true);
        let durationInput: string | null = interaction.options.getString('duration', false);
        const reason: string = interaction.options.getString('reason', false) || 'No reason provided';

        if (!interaction.guild) {
            return await interaction.editReply({ content: 'This command can only be used in a server.' });
        }

        let member: GuildMember;
        try {
            member = await interaction.guild.members.fetch(user.id);
        } catch {
            return await interaction.editReply({ content: 'User not found in this server.' });
        }

        const { dataSource } = this.client;
        const repository = dataSource.getRepository(Timeout);

        switch (action) {
            case 0:
                if (!durationInput) {
                    durationInput = '10y';
                }

                const duration = this.client.util.parseDuration(durationInput);
                if (!duration) {
                    return await interaction.editReply({
                        content: 'Invalid duration format. Use format like: 10m, 1h, 2d (max 10 years)'
                    });
                }

                const { timeout } = this.client.util;
                const timeoutUser = timeout.bind(this.client.util);

                if (await timeoutUser((await interaction.guild.members.fetch(interaction.user.id)), member, durationInput, reason, type)) {
                    await interaction.editReply({
                        content: `${user.tag} has been timed out for ${durationInput}.\nReason: ${reason}`
                    });
                } else {
                    await interaction.editReply({
                        content: 'Failed to timeout user. Check bot permissions or if user is already timed out.'
                    });
                }

                break;

            case 1:
                try {
                    if (type === 0) {
                        await member.timeout(null, `Timeout removed by ${interaction.user.tag}`);
                    } else if (type === 1) {
                        const timeoutRoleId = this.client.roleIds.teamformingTimeout
                        await member.roles.remove(timeoutRoleId).catch(() => {});
                    }

                    await repository.update(
                        { user: user.id, isActive: true },
                        { isActive: false }
                    );

                    await interaction.editReply({
                        content: `Timeout removed from ${user.tag}.`
                    });
                } catch (error) {
                    await interaction.editReply({
                        content: 'Failed to remove timeout. User may not be timed out or bot lacks permissions.'
                    });
                }
                break;

            default:
                await interaction.editReply({ content: 'Invalid action specified.' });
        }
    }
}
