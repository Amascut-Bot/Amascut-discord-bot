import BotInteraction from '../../types/BotInteraction';
import { ActionRowBuilder, Attachment, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Role, SlashCommandBuilder, TextChannel, User } from 'discord.js';
import { Report } from "../../entity/Report"

interface CombinationParent {
    [roleKey: string]: string;
}

export default class Say extends BotInteraction {
    get name() {
        return 'report';
    }

    get description() {
        return 'Report a player for matchmaking reasons.';
    }

    get combinationParent(): CombinationParent {
        return {
            'duoRootskips': 'rootskips',
            'threeSevenRootskips': 'rootskips',
            'duoExperienced': 'experienced',
            'threeSevenExperienced': 'experienced',
            'duoMaster': 'master',
            'threeSevenMaster': 'master',
            'duoGrandmaster': 'grandmaster',
            'threeSevenGrandmaster': 'grandmaster'
        }
    }

    get options() {
        const assignOptions: any = {
            'NoRealm': 'noRealm',
            'Duo RootSkips': 'duoRootskips',
            '3-7 RootSkips': 'threeSevenRootskips',
            'Duo Experienced': 'duoExperienced',
            '3-7 Experienced': 'threeSevenExperienced',
            'Duo Master': 'duoMaster',
            '3-7 Master': 'threeSevenMaster',
            'Duo Grandmaster': 'duoGrandmaster',
            '3-7 Grandmaster': 'threeSevenGrandmaster'
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
            .addUserOption((option) => option.setName('user').setDescription('User that committed the offence').setRequired(true))
            .addStringOption((option) => option.setName('role').setDescription('Matchmaking role to report').addChoices(
                ...this.options
            ).setRequired(true))
            .addStringOption((option) => option.setName('description').setDescription('Description of the incident that occurred').setRequired(true))
            .addStringOption((option) => option.setName('evidence').setDescription('Any screenshot or vod URLs regarding the report').setRequired(false))
            .addAttachmentOption((option) => option.setName('screenshot').setDescription('Any image screenshots regarding the report').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const description: string = interaction.options.getString('description', true);
        const evidence: string | null = interaction.options.getString('evidence', false);
        const screenshot: Attachment | null = interaction.options.getAttachment('screenshot', false);
        const userResponse: User = interaction.options.getUser('user', true);
        const role: string = interaction.options.getString('role', true);

        const { colours, roles, channels, stripRole } = this.client.util;

        // Check if user can even be removed from these roles.

        let success = true;
        let errorMessage = 'An error has occurred!';

        const user = await interaction.guild?.members.fetch(userResponse.id);
        const userRoles = user?.roles.cache.map(role => role.id) || [];

        const hasRoleOrCombinationRole = () => {
            const roleId = stripRole(roles[role]);
            if (this.combinationParent[role]) {
                const combinationRoleId = stripRole(roles[this.combinationParent[role]]);
                return userRoles.includes(roleId) || userRoles.includes(combinationRoleId);
                // The case where theres no parent (NoRealm) but the role still exists
            } else if (!this.combinationParent[role] && roleId) {
                return userRoles.includes(roleId);
            } else {
                return false;
            }
        }

        if (hasRoleOrCombinationRole()) {
            const getReportsForRole = async () => {
                try {
                    const reportRepository = this.client.dataSource.getRepository(Report);
                    const [_dbReports, reportsCount] = await reportRepository.findAndCount({
                        where: { 
                            reportedUser: `<@${userResponse.id}>`,
                            role: roles[role],
                            expired: false
                        } 
                    })
                    return reportsCount;
                } catch {
                    return 0;
                }
            }

            const roleObject = await interaction.guild?.roles.fetch(stripRole(roles[role])) as Role;

            const reportCount = await getReportsForRole();

            const logEmbed = new EmbedBuilder()
                .setTimestamp()
                .setColor(roleObject.color || colours.discord.red)
                .setDescription(`
                > **General**\n
                \`Submitter:\` <@${interaction.user.id}>
                \`Reported User:\` <@${userResponse.id}>
                \`Role:\` ${roles[role]}\n
                > **Evidence**\n
                \`\`\`${description}\`\`\`${evidence ? `\n\`URL:\` [${evidence}](${evidence})` : ''}${screenshot ? '\n_Additionally see embedded image below._' : ''}
                ${evidence || screenshot ? '\n' : ''}> **Moderation**\n
                This user currently has **${reportCount}** report${reportCount !== 1 ? 's' : ''} for <@&${stripRole(roles[role])}>.
                `);

            const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('approveReport')
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('rejectReport')
                        .setLabel('Reject')
                        .setStyle(ButtonStyle.Danger),
                );

            if (screenshot) {
                if (screenshot?.contentType?.includes('image')) {
                    logEmbed.setImage(screenshot.url);
                } else {
                    success = false;
                }
            }

            if (success) {
                const logChannel = await this.client.channels.fetch(channels.reportLog) as TextChannel;
                await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });
            }

            const userEmbed = new EmbedBuilder()
                .setTitle(success ? 'Your report has been submitted!' : 'An error has occurred!')
                .setColor(success ? colours.discord.green : colours.discord.red)
                .setDescription(success ? `An ${roles.admin} will review your report and handle it shortly.` : 'Your file upload must be an image.');
            return await interaction.editReply({ embeds: [userEmbed] });
        } else {
            if (this.combinationParent[role]) {
                errorMessage = `This user does not have ${roles[role]} or its combination role, ${roles[this.combinationParent[role]]}.`;
            } else {
                errorMessage = `This user does not have ${roles[role]}.`;
            }
            const userEmbed = new EmbedBuilder()
                .setTitle('An error has occurred!')
                .setColor(colours.discord.red)
                .setDescription(errorMessage);
            return await interaction.editReply({ embeds: [userEmbed] });
        }
    }
}
