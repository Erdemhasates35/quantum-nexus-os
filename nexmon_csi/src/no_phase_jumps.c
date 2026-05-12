/***************************************************************************
 *                                                                         *
 *          ###########   ###########   ##########    ##########           *
 *         ############  ############  ############  ############          *
 *         ##            ##            ##   ##   ##  ##        ##          *
 *         ##            ##            ##   ##   ##  ##        ##          *
 *         ###########   ####  ######  ##   ##   ##  ##    ######          *
 *          ###########  ####  #       ##   ##   ##  ##    #    #          *
 *                   ##  ##    ######  ##   ##   ##  ##    #    #          *
 *                   ##  ##    #       ##   ##   ##  ##    #    #          *
 *         ############  ##### ######  ##   ##   ##  ##### ######          *
 *         ###########    ###########  ##   ##   ##   ##########           *
 *                                                                         *
 *            S E C U R E   M O B I L E   N E T W O R K I N G              *
 *                                                                         *
 * Copyright (c) 2024 Jakob Link, Francesco Gringoli                       *
 *                                                                         *
 * Permission is hereby granted, free of charge, to any person obtaining a *
 * copy of this software and associated documentation files (the           *
 * "Software"), to deal in the Software without restriction, including     *
 * without limitation the rights to use, copy, modify, merge, publish,     *
 * distribute, sublicense, and/or sell copies of the Software, and to      *
 * permit persons to whom the Software is furnished to do so, subject to   *
 * the following conditions:                                               *
 *                                                                         *
 * 1. The above copyright notice and this permission notice shall be       *
 *    include in all copies or substantial portions of the Software.       *
 *                                                                         *
 * 2. Any use of the Software which results in an academic publication or  *
 *    other publication which includes a bibliography must include         *
 *    citations to the nexmon project a) and the paper cited under b):     *
 *                                                                         *
 *    a) "Matthias Schulz, Daniel Wegemer and Matthias Hollick. Nexmon:    *
 *        The C-based Firmware Patching Framework. https://nexmon.org"     *
 *                                                                         *
 *    b) "Francesco Gringoli, Matthias Schulz, Jakob Link, and Matthias    *
 *        Hollick. Free Your CSI: A Channel State Information Extraction   *
 *        Platform For Modern Wi-Fi Chipsets. Accepted to appear in        *
 *        Proceedings of the 13th Workshop on Wireless Network Testbeds,   *
 *        Experimental evaluation & CHaracterization (WiNTECH 2019),       *
 *        October 2019."                                                   *
 *                                                                         *
 * 3. The Software is not used by, in cooperation with, or on behalf of    *
 *    any armed forces, intelligence agencies, reconnaissance agencies,    *
 *    defense agencies, offense agencies or any supplier, contractor, or   *
 *    research associated.                                                 *
 *                                                                         *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS *
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF              *
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  *
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY    *
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,    *
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE       *
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                  *
 *                                                                         *
 **************************************************************************/

#if NEXMON_CHIP == CHIP_VER_BCM4366c0

#pragma NEXMON targetregion "patch"

#include <firmware_version.h>
#include <wrapper.h>
#include <structs.h>
#include <patcher.h>
#include <helper.h>
#include <local_wrapper.h>

extern uint32 no_phase_jumps;

void
phy_utils_mod_phyreg__hook(void *pi, uint16 addr, uint16 mask, uint16 val)
{
    if (!no_phase_jumps)
        phy_reg_mod(pi, addr, mask, val);
}
__attribute__((at(0x217C14, "", CHIP_VER_BCM4366c0, FW_VER_10_10_122_20)))
BLPatch(phy_utils_mod_phyreg__hook1, phy_utils_mod_phyreg__hook)

void
wlc_phy_force_rfseq_acphy__hook(void *pi, uint8 cmd)
{
    if (!no_phase_jumps)
        wlc_phy_force_rfseq_acphy__local(pi, cmd);
}
__attribute__((at(0x217C82, "", CHIP_VER_BCM4366c0, FW_VER_10_10_122_20)))
BLPatch(wlc_phy_force_rfseq_acphy__hook1, wlc_phy_force_rfseq_acphy__hook)
__attribute__((at(0x217C8A, "", CHIP_VER_BCM4366c0, FW_VER_10_10_122_20)))
BLPatch(wlc_phy_force_rfseq_acphy__hook2, wlc_phy_force_rfseq_acphy__hook)

void
wlc_phy_resetcca_acphy__hook(void *pi)
{
    if (!no_phase_jumps)
        wlc_phy_resetcca_acphy__local(pi);
}
__attribute__((at(0x217CF8, "", CHIP_VER_BCM4366c0, FW_VER_10_10_122_20)))
BLPatch(wlc_phy_resetcca_acphy__hook1, wlc_phy_resetcca_acphy__hook)

#endif
