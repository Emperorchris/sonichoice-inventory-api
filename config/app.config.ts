import { registerAs } from "@nestjs/config";


export default registerAs('app', () => ({
    port: process.env.PORT || 3000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
}))