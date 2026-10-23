package net.evmodder.evmod.mixin;

import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;
import net.evmodder.evmod.keybinds.KeybindCraftingRestock;

@Mixin(value=KeybindCraftingRestock.class, remap=false)
public interface AccessorKeybindCraftingRestock{
	@Invoker("checkIfCraftAction") void callCheckIfCraftAction(AbstractContainerMenu menu, int slot, int button, ContainerInput action, boolean automated);
	@Invoker("onServerSlotUpdate") void callOnServerSlotUpdate(int containerId, int stateId, int slot, ItemStack result);
	@Invoker("onServerContainerContent") void callOnServerContainerContent();
}