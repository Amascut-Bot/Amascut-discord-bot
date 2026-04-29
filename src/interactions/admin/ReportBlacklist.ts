import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User, MessageFlags } from 'discord.js';
import { ReportBlacklist } from '../../entity/ReportBlacklist';

export default class AddReportBlacklistCommand extends BotInteraction {
    get name() {
        return 'report-blacklist';
    }

    get description() {
        return 'Manage users who are blacklisted from reporting';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a user to the report blacklist')
                    .addUserOption(option => option.setName('user').setDescription('User to blacklist').setRequired(true))
                    .addStringOption(option => option.setName('reason').setDescription('Reason for blacklist').setRequired(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a user from the report blacklist')
                    .addUserOption(option => option.setName('user').setDescription('User to remove').setRequired(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all report blacklisted users')
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();
        const repository = this.client.dataSource.getRepository(ReportBlacklist);
        const { colours } = this.client.util;

        if (subcommand === 'add') {
            const user: User = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason', true);

            const existing = await repository.findOne({ where: { userId: user.id } });
            if (existing) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(colours.discord.red)
                    .setDescription(`<@${user.id}> is already blacklisted.`);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            const blacklist = repository.create({
                userId: user.id,
                addedBy: interaction.user.id,
                reason: reason
            });
            await repository.save(blacklist);

            const successEmbed = new EmbedBuilder()
                .setTitle('User added to blacklist')
                .setColor(colours.discord.green)
                .setDescription(`<@${user.id}> has been blacklisted from reporting.`)
                .addFields({ name: 'Reason', value: reason });
            await interaction.editReply({ embeds: [successEmbed] });
        }

        if (subcommand === 'remove') {
            const user: User = interaction.options.getUser('user', true);

            const existing = await repository.findOne({ where: { userId: user.id } });
            if (!existing) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(colours.discord.red)
                    .setDescription(`<@${user.id}> is not on the blacklist.`);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            await repository.remove(existing);

            const successEmbed = new EmbedBuilder()
                .setTitle('User removed from blacklist')
                .setColor(colours.discord.green)
                .setDescription(`<@${user.id}> has been removed from the report blacklist.`);
            await interaction.editReply({ embeds: [successEmbed] });
        }

        if (subcommand === 'list') {
            const allBlacklisted = await repository.find();

            if (allBlacklisted.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor(colours.discord.blue)
                    .setDescription('No users are currently blacklisted from reporting.');
                return await interaction.editReply({ embeds: [emptyEmbed] });
            }

            const blacklistList = allBlacklisted.map(entry =>
                `<@${entry.userId}> | Added by <@${entry.addedBy}> | Reason: ${entry.reason}`
            ).join('\n');

            const listEmbed = new EmbedBuilder()
                .setTitle('Report Blacklist')
                .setColor(colours.discord.blue)
                .setDescription(blacklistList);
            await interaction.editReply({ embeds: [listEmbed] });
        }
    }
}