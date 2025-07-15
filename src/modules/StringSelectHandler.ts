import { StringSelectMenuInteraction, InteractionResponse, Message, EmbedBuilder, Role, MessageFlags } from 'discord.js';
import Bot from '../Bot';

export default interface StringSelectHandler { client: Bot; id: string; interaction: StringSelectMenuInteraction }

export default class StringSelectHandler {
    constructor(client: Bot, id: string, interaction: StringSelectMenuInteraction<'cached'>) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;
        switch (id) {            
            default:
                if (id.startsWith('selfassign')) {
                    this.handleSelfAssign(interaction);
                }
                break;
        }
    }    

    private async handleSelfAssign(interaction: StringSelectMenuInteraction<'cached'>) : Promise<Message<true> | InteractionResponse<true> | void> {
        interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { colours } = this.client.util;
        const user = await interaction.guild?.members.fetch(interaction.user.id);
        const userRoles = await user?.roles.cache.map(role => role.id) || [];

        const selectedRole: string = interaction.values[0];

        //reset the StringSelectionMenu
        const container = interaction.message.components;
        if (interaction.isMessageComponent()){
            await interaction.message.edit({ components: container});
        }

        //parse the id <role>{;<neededRole>;<neededRole>}
        //first id has always the 'to-be-assigned'-Role, ids after are check-roles if user has sufficient tag
        const roleIds: string[] = selectedRole.split(";");
        let roleReqError: string = "";
        const addResultEmbed = new EmbedBuilder()
            .setColor(colours.discord.green)
            .setDescription(`<@&${roleIds[0]}> successfully applied.`);

        const removeResultEmbed = new EmbedBuilder()
            .setColor(colours.discord.green)
            .setDescription(`<@&${roleIds[0]}> successfully removed.`);

        //Blacklist tags that are able to change roles
        const roleObject = interaction.guild.roles.cache.get(roleIds[0]);

        if (roleObject?.permissions.has('ManageRoles')) {
            return await interaction.editReply({embeds: [new EmbedBuilder()
                .setColor(colours.discord.red)
                .setDescription(`Unallowed Role-Assign!`)]});
        }

        //TODO: cleanup all other cosmetic tags
        //TODO: some sort of hierarchy logic

        //remove should always work
        if (userRoles.includes(roleIds[0])) {
            await user.roles.remove(roleIds[0]);
            await this.client.logReactionRoleChange(user, roleObject!, 'removed');
            return await interaction.editReply({embeds: [removeResultEmbed]});
        } else if (roleIds.length == 1) {
            //if it's only assign, just do it
            if (!userRoles.includes(roleIds[0])) {
                await user.roles.add(roleIds[0]);
                await this.client.logReactionRoleChange(user, roleObject!, 'added');
                return await interaction.editReply({embeds: [addResultEmbed]});
            }
        } else if (roleIds.length > 1) {
            //check for required tags
            for (let i = 1; i < roleIds.length; i++) {                
                if (userRoles.includes(roleIds[i])) {
                    await user.roles.add(roleIds[0]);
                    await this.client.logReactionRoleChange(user, roleObject!, 'added');
                    return await interaction.editReply({embeds: [addResultEmbed]});
                }
                
                if (i > 1) {
                    roleReqError += ", ";
                }

                roleReqError += `<@&${roleIds[i]}>`;                    
            }

            const errorEmbed = new EmbedBuilder()
                .setColor(colours.discord.red)
                .setDescription(`You need any of the following tags to set this colour!\nTags:${roleReqError}`);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        return interaction.editReply("somehow i did nothing?");
    }
}
