import { getChannels, getRoles } from '../../GuildSpecifics';
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
        return 'ELEVATED_ROLE';
    }

    get hierarchy(): Hierarchy {
        return {
            killCount: ['']
        }
    }

    get removeHierarchy(): RemoveHierarchy {
        return {
            //'role': ['lower roles']
        }
    }

    get options() {
        const assignOptions: any = {
            'Silver spoon': 'silverSpoon',
            'Golden spoon': 'goldenSpoon',
            'Release Week 500%': 'releaseWeek500',
            'Release Week 1000%': 'releaseWeek1k',
            'the Sunforged (Release week 4000%)': 'sunforged',
            'the Lightbearer (Release week 2000%)': 'lightbearer',
            'Release day 4k': 'releaseDay4k',
            'Cat-Bound Initiate (100KC)': 'catBoundInitiate',
            'Scarab-Marked Disciple (250KC)': 'scarabMarkedDisciple',
            'Whisperer of the Wanderer (500KC)': 'whispererOfTheWanderer',
            'Bearer of the Unholy Sigil (750KC)': 'bearerOfTheUnholySigil',
            'Fang of the Devourer (1000KC)': 'fangOfTheDevourer',
            'Visionmaker (Full Log)': 'visionmaker',
            'Tumeken mask (5)': 'tumekenMask',
            'Tumeken robe top (5)': 'tumekenRobeTop',
            'Tumeken robe bottom (5)': 'tumekenRobeBottom',
            'Tumeken gloves (5)': 'tumekenGloves',
            'Tumeken boots (5)': 'tumekenBoots',
            'Devourers guard (5)': 'devourersGuard',
            'Tumekenslight (5)': 'tumekensLight',
            'Amaskitty': 'amaskitty',
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
    }

    private isVerifiedEligible(role: string) : Boolean {
        const verifiedRoles: string[] = ['releaseWeek500', 'releaseWeek1k', 'sunforged', 'lightbearer', 'releaseDay4k'];

        if (verifiedRoles.includes(role)) return true;

        return false;
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

        const { colours, stripRole, categorizeChannel, categorize } = this.client.util;

        const outputChannelId = categorizeChannel(role) ? getChannels(interaction.guild?.id)[categorizeChannel(role)] : '';
        let channel;
        if (outputChannelId) {
            channel = await this.client.channels.fetch(outputChannelId) as TextChannel;
        }

        const user = await interaction.guild?.members.fetch(userResponse.id);
        const userRoles = await user?.roles.cache.map(role => role.id) || [];

        let sendMessage = false;
        let anyAdditionalRole;
        const roleObject = await interaction.guild?.roles.fetch(stripRole(getRoles(interaction.guild?.id)[role])) as Role;
        let embedColour = colours.discord.green;

        const hasHigherRole = (role: string) => {
            try {
                if (!categorize(role)) return false;
                const categorizedHierarchy = this.hierarchy[categorize(role)];
                if (!categorizedHierarchy) return false;
                const sliceFromIndex: number = categorizedHierarchy.indexOf(role) + 1;
                const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                const hierarchyIdList = hierarchyList.map((item: string) => stripRole(getRoles(interaction.guild?.id)[item]));
                const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                if (intersection.length === 0) {
                    return false
                } else {
                    return true
                };
            }
            catch (err) { return false }
        }

        const roleId = stripRole(getRoles(interaction.guild?.id)[role]);
        if (!hasHigherRole(role)) {
            await user?.roles.add(roleId);

            // if role qualifies for verified automatically assign aswell
            // if (this.isVerifiedEligible(role)) {
            //     const verifiedId = stripRole(getRoles(interaction.guild?.id).verified);
            //     if (!userRoles.includes(verifiedId)) {
            //         await user?.roles.add(verifiedId);
            //     }
            // }
        }
        embedColour = roleObject.color ?? this.client.color;
        if (!(userRoles?.includes(roleId)) && !hasHigherRole(role)) {
            sendMessage = true;
        }
        if (role in this.removeHierarchy) {
            for await (const roleToRemove of this.removeHierarchy[role]) {
                const removeRoleId = stripRole(getRoles(interaction.guild?.id)[roleToRemove]);
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
            Congratulations to <@${userResponse.id}> on achieving ${getRoles(interaction.guild?.id)[role]}!
            ${anyAdditionalRole ? `By achieving this role, they are also awarded ${getRoles(interaction.guild?.id)[anyAdditionalRole]}!` : ''}
            `);
        if (sendMessage && channel) await channel.send({ embeds: [embed] }).then(message => {
            returnedMessage.id = message.id;
            returnedMessage.url = message.url;

            const emojis = ['Pog', 'gz'];

            for (let index = 0; index < emojis.length; index++) {
                const emoji = this.client.emojiCache.get(emojis[index]);

                if (emoji) {
                    message.react(emoji);
                }
            }
        });

        const logChannel = await this.client.channels.fetch(getChannels(interaction.guild?.id).botRoleLog) as TextChannel;
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
            ${getRoles(interaction.guild?.id)[role]} was assigned to <@${userResponse.id}> by <@${interaction.user.id}>.
            ${anyAdditionalRole ? `${getRoles(interaction.guild?.id)[anyAdditionalRole]} was also assigned.\n` : ''}
            **Message**: [${returnedMessage.id}](${returnedMessage.url})
            `);
        if (sendMessage) await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });

        const replyEmbed = new EmbedBuilder()
            .setTitle(sendMessage ? 'Role successfully assigned!' : 'Role assign failed.')
            .setColor(sendMessage ? colours.discord.green : colours.discord.red)
            .setDescription(sendMessage ? `
            **Member:** <@${userResponse.id}>
            **Role:** ${getRoles(interaction.guild?.id)[role]}
            ${anyAdditionalRole ? `**Additional Roles:** ${getRoles(interaction.guild?.id)[anyAdditionalRole]}` : ''}
            ` : `This user either has this role, or a higher level role.`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}
