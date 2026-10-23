package net.evmodder.evmod.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
import net.evmodder.evmod.onTick.UpdateContainerContents;
import net.minecraft.network.chat.MutableComponent;

@Mixin(value=UpdateContainerContents.class, remap=false)
interface AccessorUpdateContainerContents{
	@Accessor("customTitle") static MutableComponent customTitle(){throw new AssertionError();}
}