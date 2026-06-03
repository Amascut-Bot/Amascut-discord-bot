# Amascut, Goddess of Destruction Utility Bot

A project for Amascut Discord staff.

<a href="https://discord.gg/amascut"><img src="https://discordapp.com/api/guilds/885457551397912596/widget.png?style=banner2" alt="Discord invite"></a>

## Installation / Running the Bot

1. `npm install`
2. Create `config.json` in the repo root — copy `config.example.json` and fill it in (see [Configuration](#configuration)).
3. Create `.env` in the repo root — copy `.env.example` and set at least `TOKEN`, `ENVIRONMENT`, and `GUILD_ID`.

Both `config.json` and `.env` are gitignored (they hold secrets / per-deployment values), so each environment provides its own.

### Getting Started

```shell
npm install
cp config.example.json config.json   # then edit
cp .env.example .env                  # then edit
npm run start
```

## Configuration

### `.env`

| Variable | Required | Purpose |
| --- | --- | --- |
| `TOKEN` | yes | Discord bot token. Boot throws `Token Missing` without it. |
| `ENVIRONMENT` | yes | Free-form label (e.g. `development` / `production`). Boot throws `Environment Missing` without it. |
| `GUILD_ID` | for guild features | Selects the role/channel maps in `src/GuildSpecifics.ts`. The MAIN guild (`885457551397912596`) is the only map with trialee-chat and the scheduled-trial reminder/ping targets; any other id falls back to test-server behavior. |
| `CLUSTER_ID`, `ERROR_WEBHOOK_URL`, `INFO_WEBHOOK_URL`, `GOOGLE_*`, `TWITCH_*` | optional | Only needed if you exercise the corresponding feature (sharding/logging, Google Sheets, Twitch). |

### `config.json`

Lives at the repo root. Shape (see `config.example.json`):

| Key | Type | Purpose |
| --- | --- | --- |
| `colours` | `{ green, red, blue }` (color ints) | Embed / Components V2 accent colors. |
| `owners` | `string[]` (user IDs) | Owner-gated commands (`OWNER` permission). Add your Discord user ID. |
| `kph` | `number` | Kills/hour used by the boss-revenue GP/hour calc. |
| `guildMessageDisabled` | `string[]` (guild IDs) | Guilds where message handling is disabled. |
| `lastChannelId` / `lastMessageId` | `string` | BossRevenueV2 refresh target; leave empty to skip. |

### Acknowledgements

- [txj-xyz](https://github.com/txj-xyz) for the bot framework.
- [discord.js](https://discord.js.org/#/) for the TypeScript Discord API.
