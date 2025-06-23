import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, User, Role, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

interface Hierarchy {
    [key: string]: string[];
}

interface RemoveHierarchy {
    [key: string]: string[];
}
export default class Pass extends BotInteraction {
    get name() {
        return 'assign-cosmetic';
    }

    get description() {
        return 'Assigns a Cosmetic role to a user';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get hierarchy(): Hierarchy {
        return {
            killCount: ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave', 'solakSimp', 'solakLegend']
        }
    }

    get removeHierarchy(): RemoveHierarchy {
        return {
            'solakCasual': ['solakRookie'],
            'solakEnthusiast': ['solakRookie', 'solakCasual'],
            'solakAddict': ['solakRookie', 'solakCasual', 'solakEnthusiast'],
            'unlockedPerdita': ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict'],
            'solakFanatic': ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita'],
            'solakSlave': ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic'],
            'solakSimp': ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave'],
            'solakLegend': ['solakRookie', 'solakCasual', 'solakEnthusiast', 'solakAddict', 'unlockedPerdita', 'solakFanatic', 'solakSlave', 'solakSimp'],
        }
    }

    get options() {
        const assignOptions: any = {
            'Solak WR holder': 'solakWRHolder',
            "Erethdor's Bane": 'erethdorsBane',
            'Guardian of the Grove': 'guardianOfTheGrove',
            'Solak Rookie (100KC)': 'solakRookie',
            'Solak Casual (300KC)': 'solakCasual',
            'Solak Enthusiast (500KC)': 'solakEnthusiast',
            'Solak Addict (800KC)': 'solakAddict',
            'Unlocked Perdita (1000KC)': 'unlockedPerdita',
            'Solak Fanatic (1500KC)': 'solakFanatic',
            'Solak Slave (3000KC)': 'solakSlave',
            'Solak Simp (6000KC)': 'solakSimp',
            'Solak Legend (10000KC)': 'solakLegend',
            'Night Out With My Right Hand (10 BBC)': 'nightOutWithMyRightHand',
            'Probably Uses Special Scissors (10 OH BBC)': 'probablyUsesSpecialScissors',
            'One for the Books (15 Grimoire)': 'oneForTheBooks',
            'Broken Printer (1500 Grimoire Pages)': 'brokenPrinter',
            "Merethiel's Simp (10 Staves)": 'merethielsSimp',
            'Shroom Dealer (10 Mushrooms)': 'shroomDealer'
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

        const outputChannelId = categorizeChannel(role) ? channels[categorizeChannel(role)] : '';
        let channel;
        if (outputChannelId) {
            channel = await this.client.channels.fetch(outputChannelId) as TextChannel;
        }

        const user = await interaction.guild?.members.fetch(userResponse.id);
        const userRoles = await user?.roles.cache.map(role => role.id) || [];

        let sendMessage = false;
        let anyAdditionalRole;
        const roleObject = await interaction.guild?.roles.fetch(stripRole(roles[role])) as Role;
        let embedColour = colours.discord.green;

        const hasHigherRole = (role: string) => {
            try {
                if (!categorize(role)) return false;
                const categorizedHierarchy = this.hierarchy[categorize(role)];
                if (!categorizedHierarchy) return false;
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

        const roleId = stripRole(roles[role]);
        if (!hasHigherRole(role)) await user?.roles.add(roleId);
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