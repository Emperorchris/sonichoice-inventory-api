import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { AcceptInviteDto, CreateInviteDto } from './dto/create-invite.dto';
import { IsPublic } from 'decorator/isPublic.decorator';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) { }

  @Post("send")
  create(@Body() createInviteDto: CreateInviteDto) {
    return this.invitesService.sendInvite(createInviteDto);
  }
  @Post("accept")
  acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(acceptInviteDto);
  }

  @IsPublic()
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    return this.invitesService.findAll(Number(page) || 1, search);
  }

  @IsPublic()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invitesService.remove(id);
  }
}
