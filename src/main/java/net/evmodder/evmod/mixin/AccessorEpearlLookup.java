package net.evmodder.evmod.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;
import net.evmodder.evmod.apis.EpearlLookup;

@Mixin(value=EpearlLookup.class, remap=false)
public interface AccessorEpearlLookup{
	@Invoker("onServerTime") void callOnServerTime(long gameTime);
	@Invoker("resetConnectionReadiness") void callResetConnectionReadiness();
}