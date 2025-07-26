# SollyV3 Reaction Role System Manual

This document provides a complete guide to using the reaction role system for the SollyV3 bot.

## Overview

The reaction role system allows server administrators to create messages where users can react with emojis to automatically receive specific roles. The system is designed around **Categories**, which are groups of related roles that can be managed together. It also features a **Hierarchy** system to create tiered role progression, allowing users with higher-level roles to claim lower-level ones.

---

## Commands

There are four main commands that control the entire system.

### 1. `/add-reaction-role`

This command is used to define a new reaction role and add it to a category.

**Parameters:**
-   `category` (Required): The name of the category to add this role to. If the category doesn't exist, it will be created automatically. (e.g., "Kill Count", "Server Roles").
-   `emoji` (Required): The emoji that users will react with. This can be a standard Unicode emoji or a custom server emoji.
-   `role-given` (Required): The role that will be assigned to the user when they react.
-   `hierarchy` (Optional): A number that defines the role's position in the hierarchy for this category. Lower numbers are lower tiers. If not provided, it will automatically be set one level higher than the current max.
-   `required-role` (Optional): A specific role a user must already have to claim the `role-given`. This can be bypassed by the hierarchy system.

---

### 2. `/post-reaction-role`

This command takes a pre-defined category of roles and adds the corresponding emoji reactions to a specific message.

**Parameters:**
-   `category` (Required): The name of the category you want to post. This field uses **autocomplete** to suggest existing categories.
-   `message-id` (Required): The ID of the message you want the bot to add the reactions to.

---

### 3. `/list-reaction-role`

This command displays a neatly formatted table of all configured reaction roles, sorted by category. It is a public message, visible to everyone.

**Parameters:**
-   None.

---

### 4. `/remove-reaction-role`

This command removes a specific reaction role from a category and automatically cleans up any active messages.

**Parameters:**
-   `category` (Required): The category from which to remove the role. This field uses **autocomplete**.
-   `role` (Required): The role you wish to remove. This is a **dependent autocomplete** field; it will only show you roles that exist within the category you selected above.

**Automatic Cleanup:** When a role is removed with this command, the bot will find all messages where this category was posted and automatically remove the corresponding emoji reaction from them.

---

## Key Concepts

### Hierarchy System

The `hierarchy` parameter is a powerful feature for creating progression-based roles. Within a single category:

- A user who has a role with a **higher** hierarchy number can claim any role with a **lower** hierarchy number, even if they don't have the `required-role`.
- A user cannot claim a role that has a hierarchy number equal to or greater than their current highest role in that category without meeting the `required-role`.

This is useful for systems like "Kill Count" roles, where achieving a 100kc role should automatically grant you eligibility for the 10kc and 50kc roles.

---

## Example Workflow

Here is a simple example of how to set up a new "Server Roles" reaction message.

1.  **Add the Roles:**
    -   `/add-reaction-role category:Server Roles emoji:💻 role-given:@Developer hierarchy:1`
    -   `/add-reaction-role category:Server Roles emoji:🎨 role-given:@Artist hierarchy:1`

2.  **Create the Message:**
    -   In the channel you want the reactions, type out your message (e.g., "React to get your server roles!").
    -   Copy the **Message ID** of the message you just sent.

3.  **Post the Reactions:**
    -   `/post-reaction-role category:Server Roles message-id:<The ID you copied>`
    -   The bot will now add the 💻 and 🎨 reactions to your message.

4.  **Verify (Optional):**
    -   `/list-reaction-role`
    -   You will now see a public embed showing your new "Server Roles" category and its configured roles in a table.

5.  **Remove a Role (Optional):**
    -   `/remove-reaction-role category:Server Roles role:@Artist`
    -   The `@Artist` role will be removed from your configuration, and the 🎨 reaction will automatically disappear from the message you posted to. 