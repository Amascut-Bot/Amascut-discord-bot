import BotInteraction from '../../types/BotInteraction';
import { Override } from '../../entity/Override';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User } from 'discord.js';

export default class Pass extends BotInteraction {
    get name() {
        return 'revoke';
    }

    get description() {
        return 'Revokes a users ability to use administrative features for a Feature (i.e. rejecting reports)';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get featureOptions() {
        const assignOptions: any = {
            'Reports': 'reports',
            'Roles': 'assign',
            'Trials': 'trials'
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('feature').setDescription('Feature').addChoices(
                ...this.featureOptions
            ).setRequired(true))
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const feature: string = interaction.options.getString('feature', true);
        const user: User = interaction.options.getUser('user', true);

        const { dataSource } = this.client;
        const repository = dataSource.getRepository(Override);

        const { colours } = this.client.util;

        const existingPermissions = await repository.findOne({
            where: {
                user: user.id,
                feature: feature
            }
        })

        if (existingPermissions) {
            await repository.remove(existingPermissions);
        } else {
            const replyEmbed = new EmbedBuilder()
                .setTitle('Something went wrong!')
                .setColor(colours.discord.red)
                .setDescription(`<@${user.id}> does not have permission to use the **${feature}** feature.`);
            return await interaction.editReply({ embeds: [replyEmbed] });
        }

        const replyEmbed = new EmbedBuilder()
            .setTitle('Permissions successfully revoked!')
            .setColor(colours.discord.green)
            .setDescription(`<@${user.id}> has successfully had their permissions to use the **${feature}** feature revoked.`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}