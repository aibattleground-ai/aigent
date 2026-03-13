/**
 * AIGENT Bot — PM2 Ecosystem Config
 *
 * Usage:
 *   npx pm2 start ecosystem.config.cjs       # start
 *   npx pm2 logs aigent-bot                  # tail logs
 *   npx pm2 stop aigent-bot                  # stop
 *   npx pm2 restart aigent-bot               # restart
 *   npx pm2 save && npx pm2 startup          # auto-start on system boot
 */
'use strict';

module.exports = {
    apps: [
        {
            name: 'aigent-bot',

            // Entry point (ESM — Node runs src/index.js directly)
            script: 'src/index.js',
            interpreter: 'node',
            interpreter_args: '--experimental-vm-modules',

            // Runtime
            cwd: __dirname,
            watch: false,           // disable file-watch (use manual restart)
            instances: 1,           // single instance (Telegram polling can't be multi)

            // Restart policy
            autorestart: true,
            max_restarts: 20,
            min_uptime: '5s',       // if it dies within 5s, counts as a crash
            restart_delay: 5000,    // wait 5s before each restart attempt

            // Logs
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // Environment
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
