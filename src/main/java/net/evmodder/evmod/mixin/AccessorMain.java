package net.evmodder.evmod.mixin;

import net.evmodder.evmod.apis.EpearlLookupFabric;
import net.evmodder.evmod.apis.RemoteServerSender;
import net.evmodder.evmod.keybinds.KeybindCraftingRestock;
import net.evmodder.evmod.onTick.SyncPlayerPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;
import net.evmodder.evmod.Main;

@Mixin(value=Main.class, remap=false)
interface AccessorMain{
	@Invoker("getRemoteSenderForMixin") static RemoteServerSender getRemoteSender(){throw new AssertionError();}
	@Invoker("getEpearlLookupForMixin") static EpearlLookupFabric getEpearlLookup(){throw new AssertionError();}
	@Invoker("getKbCraftRestockForMixin") static KeybindCraftingRestock getKbCraftRestock(){throw new AssertionError();}
	@Invoker("getSyncPlayerPosForMixin") static SyncPlayerPos getSyncPlayerPos(){throw new AssertionError();}
}