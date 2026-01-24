import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User, MessageFlags } from 'discord.js';
import { VouchBlacklist } from '../../entity/VouchBlacklist';

export default class VouchBlacklistCommand extends BotInteraction {
    get name() {
        return 'vouch-blacklist';
    }

    get description() {
        return 'Manage users who are blacklisted from vouching';
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
                    .setDescription('Add a user to the vouch blacklist')
                    .addUserOption(option => option.setName('user').setDescription('User to blacklist').setRequired(true))
                    .addStringOption(option => option.setName('reason').setDescription('Reason for blacklist').setRequired(false))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a user from the vouch blacklist')
                    .addUserOption(option => option.setName('user').setDescription('User to unblacklist').setRequired(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all blacklisted users')
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();
        const repository = this.client.dataSource.getRepository(VouchBlacklist);
        const { colours } = this.client.util;

        if (subcommand === 'add') {
            const user: User = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason') || 'No reason provided';

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
                .setTitle('User Blacklisted')
                .setColor(colours.discord.green)
                .setDescription(`<@${user.id}> has been blacklisted from vouching.`)
                .addFields({ name: 'Reason', value: reason });
            await interaction.editReply({ embeds: [successEmbed] });
        }

        if (subcommand === 'remove') {
            const user: User = interaction.options.getUser('user', true);

            const existing = await repository.findOne({ where: { userId: user.id } });
            if (!existing) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(colours.discord.red)
                    .setDescription(`<@${user.id}> is not blacklisted.`);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            await repository.remove(existing);

            const successEmbed = new EmbedBuilder()
                .setTitle('User Removed from Blacklist')
                .setColor(colours.discord.green)
                .setDescription(`<@${user.id}> has been removed from the vouch blacklist.`);
            await interaction.editReply({ embeds: [successEmbed] });
        }

        if (subcommand === 'list') {
            const blacklisted = await repository.find();

            if (blacklisted.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor(this.client.color)
                    .setDescription('No users are currently blacklisted from vouching.');
                return await interaction.editReply({ embeds: [emptyEmbed] });
            }

            const listEmbed = new EmbedBuilder()
                .setTitle('Vouch Blacklist')
                .setColor(this.client.color)
                .setDescription(
                    blacklisted.map(entry => 
                        `<@${entry.userId}> - Added by <@${entry.addedBy}>\n**Reason:** ${entry.reason}`
                    ).join('\n\n')
                );
            await interaction.editReply({ embeds: [listEmbed] });
        }
    }
}