package net.evmodder.evmod.mixin;

import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;
import net.evmodder.evmod.commands.CommandPearlRescue;

@Mixin(value=CommandPearlRescue.class, remap=false)
interface AccessorCommandPearlRescue{
	@Invoker("onPlayerInfo") static void callOnPlayerInfo(ClientPacketListener connection, ClientboundPlayerInfoUpdatePacket packet){throw new AssertionError();}
}