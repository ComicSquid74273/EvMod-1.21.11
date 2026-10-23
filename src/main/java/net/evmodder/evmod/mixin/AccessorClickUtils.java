package net.evmodder.evmod.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;
import net.evmodder.evmod.apis.ClickUtils;

@Mixin(value=ClickUtils.class, remap=false)
interface AccessorClickUtils{
	@Invoker("addClick") static boolean callAddClick(boolean allowOverLimit){throw new AssertionError();}
}