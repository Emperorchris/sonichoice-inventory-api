import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "decorator/isPublic.decorator";
import { ROLES_KEY } from "decorator/roles.decorator";
import { UserRole } from "generated/prisma/enums";
import { Observable } from "rxjs";


@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector){}
   
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        if (isPublic) {
            return true;
        }

        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredRoles) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user) {
            throw new UnauthorizedException('User not authenticated');
        }

        if(!requiredRoles.includes(user.role)){
            throw new ForbiddenException('Access Denied!... You do not have the required role to access this resource');
        }

        return true;
        // return requiredRoles.some((role) => user.roles?.includes(role));
    }
    
}