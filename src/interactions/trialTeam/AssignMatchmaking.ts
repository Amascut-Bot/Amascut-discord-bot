import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, User, Role, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

interface Hierarchy {
    [key: string]: string[];
}

interface RemoveHierarchy {
    [key: string]: string[];
}
interface Prerequisites {
    [prerequisite: string]: Prerequisite
}

interface Prerequisite {
    [key: string]: string[]
}

export default class Pass extends BotInteraction {
    get name() {
        return 'assign-matchmaking';
    }

    get description() {
        return 'Assigns a Matchmaking role to a user';
    }

    get permissions() {
        return 'TRIAL_TEAM_AND_TEACHER';
    }

    get prerequisites(): Prerequisites {
        return {
            'duoRootskips': {
                'rootskips': ['threeSevenRootskips']
            },
            'threeSevenRootskips': {
                'rootskips': ['duoRootskips']
            },
            'duoExperienced': {
                'experienced': ['threeSevenExperienced']
            },
            'threeSevenExperienced': {
                'experienced': ['duoExperienced']
            },
            'duoMaster': {
                'master': ['threeSevenMaster']
            },
            'threeSevenMaster': {
                'master': ['duoMaster']
            },
            'duoGrandmaster': {
                'grandmaster': ['threeSevenGrandmaster']
            },
            'threeSevenGrandmaster': {
                'grandmaster': ['duoGrandmaster']
            }
        }
    }

    get removeHierarchy(): RemoveHierarchy {
        return {
            'threeSevenRootskips': ['noRealm'],
            'duoExperienced': ['duoRootskips'],
            'threeSevenExperienced': ['threeSevenRootskips', 'noRealm'],
            'duoMaster': ['duoExperienced', 'duoRootskips'],
            'threeSevenMaster': ['threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'duoGrandmaster': ['duoMaster', 'duoExperienced', 'duoRootskips'],
            'threeSevenGrandmaster': ['threeSevenMaster', 'threeSevenExperienced', 'threeSevenRootskips', 'noRealm'],
            'rootskips': ['noRealm'],
            'experienced': ['noRealm', 'rootskips'],
            'master': ['noRealm', 'rootskips', 'experienced'],
            'grandmaster': ['noRealm', 'rootskips', 'experienced', 'master'],
        }
    }

    get hierarchy(): Hierarchy {
        return {
            threeSeven: ['noRealm', 'threeSevenRootskips', 'rootskips', 'threeSevenExperienced', 'experienced', 'threeSevenMaster', 'master', 'threeSevenGrandmaster', 'grandmaster'],
            duo: ['duoRootskips', 'rootskips', 'duoExperienced', 'experienced', 'duoMaster', 'master', 'duoGrandmaster', 'grandmaster'],
            combined: ['rootskips', 'experienced', 'master', 'grandmaster'],
        }
    }

    get options() {
        const assignOptions: any = {
            'Verified Learner': 'verifiedLearner',
            'NoRealm': 'noRealm',
            'Duo RootSkips': 'duoRootskips',
            '3-7 RootSkips': 'threeSevenRootskips',
            'Duo Experienced': 'duoExperienced',
            '3-7 Experienced': 'threeSevenExperienced',
            'Duo Master': 'duoMaster',
            '3-7 Master': 'threeSevenMaster',
            'Duo Grandmaster': 'duoGrandmaster',
            '3-7 Grandmaster': 'threeSevenGrandmaster',
            'Verified 4s': 'fours',
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
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption((option) => option.setName('role').setDescription('Role').addChoices(
                ...this.options
            ).setRequired(true))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const userResponse: User = interaction.options.getUser('user', true);
        const role: string = interaction.options.getString('role', true);

        const { roles, colours, channels, stripRole, categorizeChannel, categorize } = this.client.util;

        const outputChannelId = categorizeChannel(role) ? (channels as any)[categorizeChannel(role)] : '';
        let channel;
        if (outputChannelId) {
            channel = await this.client.channels.fetch(outputChannelId) as TextChannel;
        }

        const user = await interaction.guild?.members.fetch(userResponse.id);
        const userRoles = user?.roles.cache.map(role => role.id) || [];

        let sendMessage = false;
        let anyAdditionalRole;
        const roleObject = await interaction.guild?.roles.fetch(stripRole(roles[role])) as Role;
        let embedColour = colours.discord.green;

        const hasHigherRole = (role: string) => {
            try {
                if (!categorize(role)) return false;
                const categorizedHierarchy = this.hierarchy[categorize(role)];
                const sliceFromIndex: number = categorizedHierarchy.indexOf(role) + 1;
                const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                const hierarchyIdList = hierarchyList.map((item: string) => stripRole(roles[item]));
                const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                if (intersection.length === 0) {
                    return false
                } else {
                    return true
                };
            }
            catch (err) { return false }
        }

        // Check for pre-requisite
        if (role in this.prerequisites) {
            // For each key inside a role pre-requisite
            for (const key in this.prerequisites[role]) {
                // Break out if they have the role already or if they have any higher role
                if (userRoles?.includes(stripRole(roles[key])) && hasHigherRole(role)) {
                    break;
                };
                let assign = true;
                // Loop over each role and check if they have all pre-requisites
                this.prerequisites[role][key].forEach((prereqRole: string) => {
                    const roleId = stripRole(roles[prereqRole]);
                    if (!(userRoles?.includes(roleId))) {
                        assign = false;
                    }
                })
                // Assign the additional role and remove the existing pre-requisite roles
                if (assign) {
                    const assignedRoleId = stripRole(roles[key]);
                    if (!(userRoles?.includes(assignedRoleId)) && !hasHigherRole(role)) {
                        sendMessage = true;
                    }
                    if (!hasHigherRole(role) && !userRoles?.includes(assignedRoleId)) await user?.roles.add(assignedRoleId);
                    embedColour = roleObject.color;
                    this.prerequisites[role][key].forEach((prereqRole: string) => {
                        const roleId = stripRole(roles[prereqRole]);
                        if (userRoles?.includes(roleId)) user?.roles.remove(roleId);
                    })
                    // Remove inferior roles for combination roles
                    if ((key in this.removeHierarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of this.removeHierarchy[key]) {
                            const removeRoleId = stripRole(roles[roleToRemove]);
                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                        };
                    }
                    if ((role in this.removeHierarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of this.removeHierarchy[role]) {
                            const removeRoleId = stripRole(roles[roleToRemove]);
                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                        };
                    }
                    anyAdditionalRole = key;
                    // Just add the new role as no pre-requisites for the combined role
                } else {
                    const roleId = stripRole(roles[role]);
                    if (!hasHigherRole(role) && !userRoles?.includes(roleId)) user?.roles.add(roleId);
                    embedColour = roleObject.color;
                    if (!(userRoles?.includes(roleId)) && !hasHigherRole(role)) {
                        sendMessage = true;
                    }
                    // Remove inferior roles
                    if ((role in this.removeHierarchy) && !hasHigherRole(role)) {
                        for await (const roleToRemove of this.removeHierarchy[role]) {
                            const removeRoleId = stripRole(roles[roleToRemove]);
                            if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                        };
                    }
                }
            }
            // No pre-requisite needed so just assign role
        } else {
            const roleId = stripRole(roles[role]);
            if (!hasHigherRole(role) && !userRoles?.includes(roleId)) await user?.roles.add(roleId);
            embedColour = roleObject.color;
            if (!(userRoles?.includes(roleId)) && !hasHigherRole(role)) {
                sendMessage = true;
            }
            if (role in this.removeHierarchy) {
                for await (const roleToRemove of this.removeHierarchy[role]) {
                    const removeRoleId = stripRole(roles[roleToRemove]);
                    if (userRoles?.includes(removeRoleId)) await user?.roles.remove(removeRoleId);
                };
            }
        }

        let returnedMessage = {
            id: '',
            url: ''
        };
        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setTimestamp()
            .setColor(embedColour)
            .setDescription(`
            Congratulations to <@${userResponse.id}> on achieving ${roles[role]}!
            ${anyAdditionalRole ? `By achieving this role, they are also awarded ${roles[anyAdditionalRole]}!` : ''}
            `);
        if (sendMessage && channel) await channel.send({ embeds: [embed] }).then(message => {
            returnedMessage.id = message.id;
            returnedMessage.url = message.url;
        });

        const logChannel = await this.client.channels.fetch(channels.botRoleLog) as TextChannel;
        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rejectRoleAssign')
                    .setLabel('Reject Approval')
                    .setStyle(ButtonStyle.Danger),
            );
        const logEmbed = new EmbedBuilder()
            .setTimestamp()
            .setColor(embedColour)
            .setDescription(`
            ${roles[role]} was assigned to <@${userResponse.id}> by <@${interaction.user.id}>.
            ${anyAdditionalRole ? `${roles[anyAdditionalRole]} was also assigned.\n` : ''}
            **Message**: [${returnedMessage.id}](${returnedMessage.url})
            `);
        if (sendMessage) await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });

        const replyEmbed = new EmbedBuilder()
            .setTitle(sendMessage ? 'Role successfully assigned!' : 'Role assign failed.')
            .setColor(sendMessage ? colours.discord.green : colours.discord.red)
            .setDescription(sendMessage ? `
            **Member:** <@${userResponse.id}>
            **Role:** ${roles[role]}
            ${anyAdditionalRole ? `**Additional Roles:** ${roles[anyAdditionalRole]}` : ''}
            ` : `This user either has this role, or a higher level role.`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}