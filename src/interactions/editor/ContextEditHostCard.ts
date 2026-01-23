import BotInteraction from '../../types/BotInteraction';
import { ApplicationCommandType, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import ComponentsV2Utils from '../../modules/ComponentsV2Utils';

export default class ContextEditHostCard extends BotInteraction {

    get name() {
        return 'Edit Host Card';
    }

    get permissions() {
        return 'TEACHER_LOREBOOK_TRIAL_TEAM';
    }

    get contextCommandData() {
        return new ContextMenuCommandBuilder()
            .setName(this.name)
            .setType(ApplicationCommandType.Message);
    }

    async run(interaction: MessageContextMenuCommandInteraction) {
        // Validation checks
        if (interaction.targetMessage.author.id != this.client.user?.id) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You can only edit messages posted by <@${this.client.user?.id}>`
            });
        }

        if (!interaction.targetMessage.flags.has(MessageFlags.IsComponentsV2)) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: 'This message is not a host card.'
            });
        }

        // Parse host card data
        const container = ComponentsV2Utils.cleanContainer(interaction.targetMessage.components[0]);
        const containerJson = JSON.stringify(container, null, 2);
        
        // Regex to find roles (e.g. "Base: <@123>" or "nWest out: `empty`")
        const regex = /([\w ]+):\s*(`empty`|<@!?[0-9]+>)\s*(`empty`|<@!?[0-9]+>)?\s*(`empty`|<@!?[0-9]+>)?\s*(`empty`|<@!?[0-9]+>)?\s*(`empty`|<@!?[0-9]+>)?/g;
        
        const roles = [];
        for (const match of containerJson.matchAll(regex)) {
            const rawLabel = match[1].trim();
            // Strip leading 'n' used for internal "needed" logic
            const label = rawLabel.startsWith('n') ? rawLabel.substring(1) : rawLabel;
            
            roles.push({
                label: label,
                rawLabel: rawLabel,
                current: match[0].split(':')[1].trim()
            });
        }

        if (roles.length === 0) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: 'Could not find any editable roles in this message.'
            });
        }

        // Step 1: Role Selection UI
        const roleSelect = new StringSelectMenuBuilder()
            .setCustomId('edit_host_role_select')
            .setPlaceholder('Select a role to edit');

        for (const role of roles) {
            roleSelect.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(role.label)
                    .setValue(role.rawLabel)
                    .setDescription(`Current: ${role.current.substring(0, 50)}`)
            );
        }

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect);

        const response = await interaction.reply({
            content: 'Select the role you want to modify:',
            components: [row],
            flags: MessageFlags.Ephemeral
        });

        try {
            // Wait for role selection
            const roleConfirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id && i.customId === 'edit_host_role_select',
                time: 60000,
                componentType: ComponentType.StringSelect
            });

            const selectedRoleRaw = roleConfirmation.values[0];
            const selectedRoleLabel = roles.find(r => r.rawLabel === selectedRoleRaw)?.label || selectedRoleRaw;

            // Step 2: User Selection UI
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('edit_host_user_select')
                .setPlaceholder(`Select user for ${selectedRoleLabel}`);

            const clearButton = new ButtonBuilder()
                .setCustomId('edit_host_clear')
                .setLabel('Set to Empty')
                .setStyle(ButtonStyle.Danger);

            const userRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
            const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

            const updateResponse = await roleConfirmation.update({
                content: `Editing **${selectedRoleLabel}**. Select a user or clear the slot.`,
                components: [userRow, buttonRow]
            });

            // Wait for final action
            const finalAction = await updateResponse.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id && ['edit_host_user_select', 'edit_host_clear'].includes(i.customId),
                time: 60000
            });

            // Determine new value
            let newValue = '`empty`';
            if (finalAction.isUserSelectMenu()) {
                newValue = `<@${finalAction.values[0]}>`;
            }

            // Update Message
            // We use the regex replace to find the specific line matching the raw label
            const newContainerJson = containerJson.replace(regex, (match, label) => {
                if (label.trim() === selectedRoleRaw) {
                    return `${label}: ${newValue}`;
                }
                return match;
            });

            const newContainer = JSON.parse(newContainerJson);
            
            await interaction.targetMessage.edit({
                components: [newContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });

            await finalAction.update({
                content: `Successfully updated **${selectedRoleLabel}** to ${newValue}.`,
                components: []
            });

        } catch (e) {
            // Handle timeout or errors
            await interaction.editReply({
                content: 'Edit cancelled or timed out.',
                components: []
            }).catch(() => {});
        }
    }
}